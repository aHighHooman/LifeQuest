/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
    browserLocalPersistence,
    browserSessionPersistence,
    onAuthStateChanged,
    setPersistence,
    signInWithEmailAndPassword,
    signOut as firebaseSignOut
} from 'firebase/auth';
import { firebaseAuth, isFirebaseConfigured } from '../services/firebase.js';
import { isLlmInterfaceLocation } from '../utils/llmInterface.js';
import {
    AUTH_SURFACES,
    getLifeQuestAccountAccess
} from '../constants/cloudAccess.js';

const AuthContext = createContext(null);

export const useAuth = () => {
    const context = useContext(AuthContext);

    if (!context) {
        throw new Error('useAuth must be used within AuthProvider.');
    }

    return context;
};

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [status, setStatus] = useState(isFirebaseConfigured ? 'loading' : 'unavailable');
    const surface = isLlmInterfaceLocation()
        ? AUTH_SURFACES.LLM
        : AUTH_SURFACES.APP;

    useEffect(() => {
        if (!firebaseAuth) return undefined;

        return onAuthStateChanged(firebaseAuth, (nextUser) => {
            if (nextUser && !getLifeQuestAccountAccess(nextUser.uid, surface)) {
                setUser(null);
                setStatus('signed-out');
                firebaseSignOut(firebaseAuth).catch((error) => {
                    console.error('Unauthorized Firebase session sign-out failed:', error);
                });
                return;
            }

            setUser(nextUser);
            setStatus(nextUser ? 'authenticated' : 'signed-out');
        }, (error) => {
            console.error('Firebase authentication state failed:', error);
            setUser(null);
            setStatus('error');
        });
    }, [surface]);

    const signIn = useCallback(async (email, password) => {
        if (!firebaseAuth) {
            throw new Error('Firebase authentication is not configured.');
        }

        const persistence = surface === AUTH_SURFACES.LLM
            ? browserSessionPersistence
            : browserLocalPersistence;
        await setPersistence(firebaseAuth, persistence);

        const credential = await signInWithEmailAndPassword(firebaseAuth, email.trim(), password);
        if (!getLifeQuestAccountAccess(credential.user.uid, surface)) {
            await firebaseSignOut(firebaseAuth);
            const error = new Error(surface === AUTH_SURFACES.LLM
                ? 'This account is not authorized for the LifeQuest LLM interface.'
                : 'This account is not authorized for the normal LifeQuest interface.');
            error.code = 'auth/unauthorized-surface';
            throw error;
        }

        return credential;
    }, [surface]);

    const signOut = useCallback(async () => {
        if (!firebaseAuth) return;
        await firebaseSignOut(firebaseAuth);
    }, []);

    const access = useMemo(
        () => getLifeQuestAccountAccess(user?.uid, surface),
        [surface, user?.uid]
    );
    const value = useMemo(() => ({
        user,
        status,
        isConfigured: isFirebaseConfigured,
        surface,
        role: access?.role || null,
        dataUid: access?.dataUid || null,
        signIn,
        signOut
    }), [access, signIn, signOut, status, surface, user]);

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
};
