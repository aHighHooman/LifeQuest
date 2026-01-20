Set WshShell = CreateObject("WScript.Shell")
' Run the batch file hidden (0)
WshShell.Run chr(34) & "C:\Users\Umair\OneDrive\Desktop\Work\Random_Projects\LifeQuest\launch-app.bat" & Chr(34), 0
Set WshShell = Nothing
