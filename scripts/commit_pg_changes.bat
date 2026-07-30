@echo off
cd /d d:\React-Projects\capsproj

echo Cleaning up junk files...
del /f /q "server\console.log*" 2>nul
del /f /q "server\{" 2>nul

echo Staging relevant source files...
git add server/utils/database.js
git add server/server.js
git add server/package.json
git add server/package-lock.json
git add server/_migrate_to_postgres.js

echo Committing...
git commit -m "feat: add Vercel Postgres support for persistent data storage"

echo Pushing to origin master...
git push origin master

echo Done!
pause
