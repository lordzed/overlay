@echo off
REM Windows batch script to run overlay and capture output
REM Save this as run-debug.bat in the overlay folder
REM Then run: run-debug.bat

echo Overlay Debug Launcher
echo =====================
echo.

REM Clear old log file
if exist app-error.log (
    del app-error.log
    echo Cleared previous log file
)

echo.
echo Starting app...
echo (App will open - errors will be saved to app-error.log)
echo.

REM Run npm start and capture output
npm start 2>&1 | tee app-output.log

echo.
echo App closed.
echo.
echo Checking for errors...
if exist app-error.log (
    echo.
    echo === ERRORS FOUND ===
    type app-error.log
) else (
    echo No errors logged.
)

echo.
echo === LAST OUTPUT ===
if exist app-output.log (
    type app-output.log
)

pause
