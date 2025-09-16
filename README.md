SocialSphere - A Full-Stack Social Media Application
SocialSphere is a mini social media platform built from the ground up, featuring core social networking functionalities. Users can create accounts, share their thoughts through posts, interact with others through comments and likes, and build their social circle by following other users.

This project demonstrates a complete full-stack development cycle, from a dynamic frontend interface to a robust backend API connected to a modern database.

Features
👤 User Authentication & Profiles: Secure user registration and login. Users have profiles displaying their bio, posts, and follower/following counts.

📝 Posts & Comments: Create, edit, and delete posts and comments with full ownership control.

❤️ Like System: Like or unlike posts with real-time like count updates.

👥 Follow System: Follow and unfollow other users to customize the content feed.

📰 Dual User Feed:

Following Feed: A personalized feed showing recent posts from followed users.

Explore Feed: Discover posts from all users across the platform.

🔒 Access Control: Proper authorization checks ensure users can only modify their own content (profiles, posts, comments).

Tech Stack
Frontend: HTML5, CSS3, JavaScript (Vanilla)

Styling: Tailwind CSS for a modern, responsive design.

Backend: Node.js, Express.js

Database: MongoDB

ORM: Prisma Client for type-safe database access and schema management.

Authentication: JWT (JSON Web Tokens) for secure session management.

Password Hashing: bcrypt.js

Getting Started
Follow these instructions to get a local copy of the project up and running.

Prerequisites
Node.js (v14 or later)

npm

Git

A free MongoDB Atlas account for the database.

Backend Setup
Clone the repository:

git clone [https://github.com/YourUsername/CodeAlpha_SocialSphere.git](https://github.com/YourUsername/CodeAlpha_SocialSphere.git)
cd CodeAlpha_SocialSphere/backend


Install dependencies:

npm install


Set up your environment variables:

Create a .env file in the backend directory.

Add your MongoDB Atlas connection string and a JWT secret:

DATABASE_URL="mongodb+srv://<user>:<password>@cluster.mongodb.net/social-media-db?retryWrites=true&w=majority"
JWT_SECRET="YOUR_SUPER_SECRET_KEY"


Whitelist your IP Address in MongoDB Atlas:

In your Atlas dashboard, go to Network Access and add your current IP address (0.0.0.0/0 for access from anywhere).

Sync the database schema:

npx prisma db push


Run the backend server:

npm run dev


The server will be running on http://localhost:3000.

Frontend Setup
Navigate to the frontend folder.

Open the index.html file directly in your web browser.

The application should now be fully functional on your local machine.
