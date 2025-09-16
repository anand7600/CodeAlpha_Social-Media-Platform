// backend/server.js

const express = require('express');
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const jwt =require('jsonwebtoken');
const cors = require('cors');
require('dotenv').config();

const prisma = new PrismaClient();
const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET;

// --- Middleware ---
app.use(cors());
app.use(express.json());

const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (token == null) return res.sendStatus(401);

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.sendStatus(403);
        req.user = user;
        next();
    });
};

// --- API Routes ---

// --- Auth Routes ---
app.post('/api/auth/signup', async (req, res) => {
    const { username, email, password } = req.body;
    if (!username || !email || !password) {
        return res.status(400).json({ message: 'All fields are required.' });
    }
    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        const user = await prisma.user.create({
            data: { username, email, password: hashedPassword },
        });
        res.status(201).json({ message: 'User created successfully', userId: user.id });
    } catch (error) {
        if (error.code === 'P2002') {
             return res.status(409).json({ message: 'Username or email already exists.' });
        }
        res.status(500).json({ message: 'Server error during signup.' });
    }
});

app.post('/api/auth/login', async (req, res) => {
    const { username, password } = req.body;
    try {
        const user = await prisma.user.findUnique({ where: { username } });
        if (!user || !await bcrypt.compare(password, user.password)) {
            return res.status(401).json({ message: 'Invalid credentials.' });
        }
        const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '24h' });
        res.json({ 
            message: 'Logged in successfully', 
            token,
            user: { id: user.id, username: user.username }
        });
    } catch (error) {
        res.status(500).json({ message: 'Server error during login.' });
    }
});

// --- User & Profile Routes ---

// Update own profile (e.g., bio)
app.put('/api/profile', authenticateToken, async (req, res) => {
    const { bio } = req.body;
    const userId = req.user.userId;
    try {
        const updatedUser = await prisma.user.update({
            where: { id: userId },
            data: { bio },
        });
        res.json(updatedUser);
    } catch(error) {
        res.status(500).json({ message: 'Error updating profile.'});
    }
});

app.get('/api/users/:id', authenticateToken, async (req, res) => {
    const { id } = req.params;
    try {
        const user = await prisma.user.findUnique({
            where: { id },
            select: {
                id: true,
                username: true,
                bio: true,
                followers: { select: { id: true } }, 
                _count: {
                    select: { posts: true, followers: true, following: true }
                }
            }
        });
        if (!user) return res.status(404).json({ message: 'User not found' });
        res.json(user);
    } catch (error) {
         res.status(500).json({ message: 'Server error fetching user.' });
    }
});

app.get('/api/users/:id/posts', authenticateToken, async(req, res) => {
    const { id } = req.params;
    try {
        const posts = await prisma.post.findMany({
            where: { authorId: id },
            orderBy: { createdAt: 'desc' },
            include: {
                author: { select: { id: true, username: true } },
                likes: { select: { userId: true }},
                 _count: { select: { comments: true }}
            }
        });
        res.json(posts);
    } catch (error) {
        res.status(500).json({ message: 'Server error fetching user posts.' });
    }
});

app.post('/api/users/:id/follow', authenticateToken, async (req, res) => {
    const targetUserId = req.params.id;
    const currentUserId = req.user.userId;

    if (targetUserId === currentUserId) {
        return res.status(400).json({ message: "You cannot follow yourself." });
    }
    
    try {
        const currentUser = await prisma.user.findUnique({
            where: { id: currentUserId },
            select: { followingIDs: true }
        });

        const isFollowing = currentUser.followingIDs.includes(targetUserId);
        const operation = isFollowing ? 'disconnect' : 'connect';
        const listOp = isFollowing ? 'pull' : 'push';

        await prisma.$transaction([
            prisma.user.update({
                where: { id: currentUserId },
                data: { 
                    following: { [operation]: { id: targetUserId } },
                    followingIDs: { [listOp]: targetUserId }
                }
            }),
            prisma.user.update({
                where: { id: targetUserId },
                data: { 
                    followers: { [operation]: { id: currentUserId } },
                    followerIDs: { [listOp]: currentUserId }
                }
            })
        ]);
        
        res.json({ message: `Successfully ${isFollowing ? 'unfollowed' : 'followed'}.` });

    } catch(error) {
        res.status(500).json({ message: 'Server error processing follow request.' });
    }
});

// --- Post Routes ---

// Get personalized feed (posts from people the user follows + own posts)
app.get('/api/posts/feed', authenticateToken, async (req, res) => {
    const currentUserId = req.user.userId;
    try {
        const currentUser = await prisma.user.findUnique({
            where: { id: currentUserId },
            select: { followingIDs: true }
        });
        
        const authorIds = [...currentUser.followingIDs, currentUserId];

        const posts = await prisma.post.findMany({
            where: { authorId: { in: authorIds } },
            orderBy: { createdAt: 'desc' },
            include: {
                author: { select: { id: true, username: true } },
                likes: { select: { userId: true }},
                _count: { select: { comments: true }}
            }
        });
        res.json(posts);
    } catch (error) {
        res.status(500).json({ message: 'Server error fetching feed.' });
    }
});

// Get explore feed (all posts)
app.get('/api/posts/explore', authenticateToken, async (req, res) => {
    try {
        const posts = await prisma.post.findMany({
            orderBy: { createdAt: 'desc' },
            include: {
                author: { select: { id: true, username: true } },
                likes: { select: { userId: true } },
                _count: { select: { comments: true } },
            },
        });
        res.json(posts);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching explore feed.' });
    }
});


// Get a single post by ID
app.get('/api/posts/:id', authenticateToken, async (req, res) => {
    const { id } = req.params;
    try {
        const post = await prisma.post.findUnique({
            where: { id },
            include: {
                author: { select: { id: true, username: true } },
                likes: { select: { userId: true } },
                _count: { select: { comments: true } },
            },
        });
        if (!post) return res.status(404).json({ message: 'Post not found' });
        res.json(post);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching post.' });
    }
});

// Create a post
app.post('/api/posts', authenticateToken, async (req, res) => {
    const { content } = req.body;
    if (!content) return res.status(400).json({ message: 'Post content cannot be empty.' });
    try {
        const post = await prisma.post.create({
            data: { content, authorId: req.user.userId },
        });
        res.status(201).json(post);
    } catch (error) {
        res.status(500).json({ message: 'Server error creating post.' });
    }
});

// Edit a post
app.put('/api/posts/:id', authenticateToken, async (req, res) => {
    const { id } = req.params;
    const { content } = req.body;
    const userId = req.user.userId;
    try {
        const post = await prisma.post.findUnique({ where: { id } });
        if (post.authorId !== userId) return res.status(403).json({ message: 'Forbidden' });

        const updatedPost = await prisma.post.update({
            where: { id },
            data: { content },
        });
        res.json(updatedPost);
    } catch (error) {
        res.status(500).json({ message: 'Error updating post' });
    }
});

// Delete a post
app.delete('/api/posts/:id', authenticateToken, async (req, res) => {
    const { id } = req.params;
    const userId = req.user.userId;
    try {
        const post = await prisma.post.findUnique({ where: { id } });
        if (!post) return res.status(404).json({ message: 'Post not found' });
        if (post.authorId !== userId) return res.status(403).json({ message: 'Forbidden' });

        await prisma.post.delete({ where: { id } });
        res.status(204).send();
    } catch (error) {
        res.status(500).json({ message: 'Error deleting post' });
    }
});

// Like/unlike a post
app.post('/api/posts/:id/like', authenticateToken, async (req, res) => {
    const postId = req.params.id;
    const userId = req.user.userId;
    try {
        const existingLike = await prisma.like.findUnique({
            where: { userId_postId: { userId, postId } },
        });

        if (existingLike) {
            await prisma.like.delete({ where: { userId_postId: { userId, postId } } });
        } else {
            await prisma.like.create({ data: { userId, postId } });
        }
        const updatedPost = await prisma.post.findUnique({
            where: { id: postId },
            include: { likes: { select: { userId: true } } }
        });
        res.json(updatedPost);
    } catch (error) {
        res.status(500).json({ message: 'Server error processing like.' });
    }
});

// --- Comment Routes ---
app.get('/api/posts/:id/comments', authenticateToken, async(req, res) => {
    const postId = req.params.id;
    try {
        const comments = await prisma.comment.findMany({
            where: { postId },
            orderBy: { createdAt: 'asc' },
            include: { author: { select: { id: true, username: true } } }
        });
        res.json(comments);
    } catch(error) {
        res.status(500).json({ message: 'Server error fetching comments.' });
    }
});

app.post('/api/posts/:id/comments', authenticateToken, async (req, res) => {
    const postId = req.params.id;
    const { content } = req.body;
    if(!content) return res.status(400).json({ message: 'Comment content cannot be empty.' });
    try {
        const comment = await prisma.comment.create({
            data: { content, authorId: req.user.userId, postId },
            include: { author: { select: { id: true, username: true }}}
        });
        res.status(201).json(comment);
    } catch(error) {
        res.status(500).json({ message: 'Server error creating comment.' });
    }
});

// Edit a comment
app.put('/api/comments/:id', authenticateToken, async (req, res) => {
    const { id } = req.params;
    const { content } = req.body;
    const userId = req.user.userId;
    try {
        const comment = await prisma.comment.findUnique({ where: { id } });
        if (comment.authorId !== userId) return res.status(403).json({ message: 'Forbidden' });

        const updatedComment = await prisma.comment.update({
            where: { id },
            data: { content },
        });
        res.json(updatedComment);
    } catch (error) {
        res.status(500).json({ message: 'Error updating comment' });
    }
});

// Delete a comment
app.delete('/api/comments/:id', authenticateToken, async (req, res) => {
    const { id } = req.params;
    const userId = req.user.userId;
    try {
        const comment = await prisma.comment.findUnique({ where: { id } });
        if (!comment) return res.status(404).json({ message: 'Comment not found' });
        if (comment.authorId !== userId) return res.status(403).json({ message: 'Forbidden' });

        await prisma.comment.delete({ where: { id } });
        res.status(204).send();
    } catch (error) {
        res.status(500).json({ message: 'Error deleting comment' });
    }
});

// --- Start Server ---
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});

