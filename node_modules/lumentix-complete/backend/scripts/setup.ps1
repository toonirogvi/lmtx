Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

Write-Host "Install Firebase CLI if needed with: npm install -g firebase-tools"
Write-Host "Firebase Emulator Suite requires JDK 21 or newer when run without Docker."
Write-Host "Start Firestore emulator in another terminal:"
Write-Host "firebase emulators:start --only firestore --project ltx-office-96354"

Write-Host "Installing backend dependencies..."
Push-Location backend
npm install
npm run seed
Pop-Location

Write-Host "Installing frontend dependencies..."
Push-Location frontend
npm install
Pop-Location

Write-Host "Setup complete. Start backend and frontend with npm run dev in each folder."
