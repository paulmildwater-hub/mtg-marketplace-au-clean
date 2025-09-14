@echo off
echo ========================================
echo     MTG Marketplace - Push Updates
echo ========================================
echo.

:: Add all changes
git add .

:: Show what's being committed
echo Files to be committed:
git status --short
echo.

:: Get commit message from user
set /p CommitMessage="Enter commit message (or press Enter for default): "
if "%CommitMessage%"=="" set CommitMessage=Update marketplace code

:: Commit changes
git commit -m "%CommitMessage%"

:: Push to GitHub
echo.
echo Pushing to GitHub...
git push origin main

:: Check if push was successful
if %ERRORLEVEL% EQU 0 (
    echo.
    echo ========================================
    echo    SUCCESS! Changes pushed to GitHub
    echo ========================================
    echo View at: https://github.com/paulmildwater-hub/mtg-marketplace-au-clean
) else (
    echo.
    echo ========================================
    echo    ERROR: Push failed. Check errors above
    echo ========================================
)

echo.
pause