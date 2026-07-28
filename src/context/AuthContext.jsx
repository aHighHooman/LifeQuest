/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
    browserLocalPersistence,
    onAuthStateChanged,
    setPersistence,
    signInWithEmailAndPassword,
    signOut as firebaseSignOut
} from 'firebase/auth';
import { firebaseAuth, isFirebaseConfigured } from '../services/firebase.js';

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

    useEffect(() => {
        if (!firebaseAuth) return undefined;

        return onAuthStateChanged(firebaseAuth, (nextUser) => {
            setUser(nextUser);
            setStatus(nextUser ? 'authenticated' : 'signed-out');
        }, (error) => {
            console.error('Firebase authentication state failed:', error);
            setUser(null);
            setStatus('error');
        });
    }, []);

    const signIn = useCallback(async (email, password) => {
        if (!firebaseAuth) {
            throw new Error('Firebase authentication is not configured.');
        }

        await setPersistence(firebaseAuth, browserLocalPersistence);
        return signInWithEmailAndPassword(firebaseAuth, email.trim(), password);
    }, []);

    const signOut = useCallback(async () => {
        if (!firebaseAuth) return;
        await firebaseSignOut(firebaseAuth);
    }, []);

    const value = useMemo(() => ({
        user,
        status,
        isConfigured: isFirebaseConfigured,
        signIn,
        signOut
    }), [signIn, signOut, status, user]);

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
};
