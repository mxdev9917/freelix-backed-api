
<!-- The error you're encountering suggests there's still a version mismatch or initialization issue with TensorFlow.js. Here's the complete, fixed solution: -->
rm -rf node_modules package-lock.json
npm install face-api.js@0.22.2 @tensorflow/tfjs@1.7.4 @tensorflow/tfjs-core@1.7.4 canvas@2.11.2 node-fetch@2.6.7 express@4.18.2 multer@1.4.5-lts.1

<!-- For Apple Silicon (M1/M2) -->

# Install required dependencies
brew install pkg-config cairo pango libpng jpeg giflib librsvg

# If still having issues, try Rosetta:
arch -x86_64 zsh
npm install
arch -x86_64 zsh
npm install
npm start





git checkout dev
# 1. Switch to the correct main branch
git checkout main

# 2. Pull latest updates from remote
git pull origin main

# 3. Merge the 'backend-eh' branch into 'main'
git merge dev

# 4. Push the merged changes to GitHub
git push origin main


# after pull on github
npm install


# Docker build and push to images
docker build --no-cache -t freelixlaos/freelix-backend:2.2.3 .
docker push freelixlaos/freelix-backend:2.2.3

# Run test image on local
docker compose -f docker-compose.dev.yml up -d
