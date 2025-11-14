# Use the official Node.js LTS image
FROM node:20

# Set the working directory
WORKDIR /app

# Copy package.json and package-lock.json
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy the rest of the application code
COPY . .

# Expose the port your app runs on (change if needed)
EXPOSE 3000

# Start the application, fix links, and create indexes
CMD ["sh", "-c", "node main.js && node fix-links.js && node create-indexes.js"]
