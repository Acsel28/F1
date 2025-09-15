const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const mysql = require('mysql2');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const dotenv = require('dotenv');
const mlService = require('./ml_service');

dotenv.config();

const app = express();
const port = process.env.PORT || 5000;

// Middleware
app.use(bodyParser.json());
app.use(cors());

// JWT Secret
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

// MySQL connection
const db = mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'leclerc',
    password: process.env.DB_PASSWORD || 'ferrari',
    database: process.env.DB_NAME || 'f1_database'
});

db.connect(err => {
    if (err) {
        console.error('Error connecting to MySQL:', err);
        return;
    }
    console.log('Connected to MySQL');
});

// Routes
app.get('/', (req, res) => {
    res.send('Welcome to the Resume API');
});

// User Routes (Authentication - Minimal example)
app.post('/login', async (req, res) => {
    const { email, password } = req.body;

    db.query('SELECT * FROM users1 WHERE email = ?', [email], async (err, results) => {
        if (err) {
            return res.status(500).json({ error: 'Database error' });
        }

        if (results.length > 0) {
            const isValidPassword = await bcrypt.compare(password, results[0].password);
            
            if (isValidPassword) {
                const token = jwt.sign(
                    { userId: results[0].user_id, email: results[0].email },
                    JWT_SECRET,
                    { expiresIn: '24h' }
                );
                
                res.json({ 
                    success: true, 
                    message: 'Login successful', 
                    token,
                    userId: results[0].user_id 
                });
            } else {
                res.status(401).json({ success: false, error: 'Invalid password' });
            }
        } else {
            res.status(401).json({ success: false, error: 'Invalid email' });
        }
    });
});

app.post('/register', (req, res) => {
    const { email, password, github_username } = req.body;

    db.query('INSERT INTO users (email, github_username) VALUES (?, ?)', [email, github_username], (err, results) => {
        if (err) {
             return res.status(500).json({ error: 'Database error', details: err.message });
        }

        db.query('UPDATE users SET password = ? WHERE email = ?', [password, email], (err, results) => {
            if (err) {
                return res.status(500).json({ error: 'Database error', details: err.message });
            }
    
            res.json({ success: true, message: 'User registered successfully', userId: results.insertId });
        });
    });
});

// **RESUME ROUTES**

// **Resumes Table**
app.get('/resumes/:userId', (req, res) => {
    const { userId } = req.params;
    db.query('SELECT * FROM resumes WHERE user_id = ?', [userId], (err, results) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        res.json(results);
    });
});

app.post('/resumes', (req, res) => {
    const { user_id, resume_json, career_goal } = req.body;

    db.query('INSERT INTO resumes (user_id, resume_json, career_goal) VALUES (?, ?, ?)',
        [user_id, JSON.stringify(resume_json), career_goal], // Stringify the JSON
        (err, results) => {
            if (err) {
                console.error('Error inserting resume:', err);
                return res.status(500).json({ error: err.message });
            }
            res.json({ id: results.insertId, ...req.body });
        });
});

app.put('/resumes/:resumeId', (req, res) => {
    const { resumeId } = req.params;
    const { user_id, resume_json, career_goal } = req.body;

    db.query('UPDATE resumes SET user_id = ?, resume_json = ?, career_goal = ? WHERE resume_id = ?',
        [user_id, JSON.stringify(resume_json), career_goal, resumeId],
        (err, results) => {
            if (err) {
                return res.status(500).json({ error: err.message });
            }
            res.json({ resumeId, ...req.body });
        });
});

app.delete('/resumes/:resumeId', (req, res) => {
    const { resumeId } = req.params;
    db.query('DELETE FROM resumes WHERE resume_id = ?', [resumeId], (err, results) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        res.json({ message: 'Resume deleted' });
    });
});

// **GitHub Projects**
app.get('/github_projects/:userId', (req, res) => {
    const { userId } = req.params;
    db.query('SELECT * FROM github_projects WHERE user_id = ?', [userId], (err, results) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        res.json(results);
    });
});

app.post('/github_projects', (req, res) => {
    const { user_id, project_name, description, technologies, impact, relevance_score, last_updated } = req.body;

    db.query('INSERT INTO github_projects (user_id, project_name, description, technologies, impact, relevance_score, last_updated) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [user_id, project_name, description, JSON.stringify(technologies), impact, relevance_score, last_updated],  // Stringify technologies JSON
        (err, results) => {
            if (err) {
                console.error('Error inserting project:', err);
                return res.status(500).json({ error: err.message });
            }
            res.json({ id: results.insertId, ...req.body });
        });
});

app.put('/github_projects/:projectId', (req, res) => {
    const { projectId } = req.params;
    const { user_id, project_name, description, technologies, impact, relevance_score, last_updated } = req.body;

    db.query('UPDATE github_projects SET user_id = ?, project_name = ?, description = ?, technologies = ?, impact = ?, relevance_score = ?, last_updated = ? WHERE project_id = ?',
        [user_id, project_name, description, JSON.stringify(technologies), impact, relevance_score, last_updated, projectId],
        (err, results) => {
            if (err) {
                return res.status(500).json({ error: err.message });
            }
            res.json({ projectId, ...req.body });
        });
});

app.delete('/github_projects/:projectId', (req, res) => {
    const { projectId } = req.params;
    db.query('DELETE FROM github_projects WHERE project_id = ?', [projectId], (err, results) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        res.json({ message: 'Project deleted' });
    });
});

// **GitHub Skills**
app.get('/github_skills/:userId', (req, res) => {
    const { userId } = req.params;
    db.query('SELECT * FROM github_skills WHERE user_id = ?', [userId], (err, results) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        res.json(results);
    });
});

app.post('/github_skills', (req, res) => {
    const { user_id, skill_name, category } = req.body;

    db.query('INSERT INTO github_skills (user_id, skill_name, category) VALUES (?, ?, ?)',
        [user_id, skill_name, category],
        (err, results) => {
            if (err) {
                console.error('Error inserting skill:', err);
                return res.status(500).json({ error: err.message });
            }
            res.json({ id: results.insertId, ...req.body });
        });
});

app.put('/github_skills/:skillId', (req, res) => {
    const { skillId } = req.params;
    const { user_id, skill_name, category } = req.body;

    db.query('UPDATE github_skills SET user_id = ?, skill_name = ?, category = ? WHERE skill_id = ?',
        [user_id, skill_name, category, skillId],
        (err, results) => {
            if (err) {
                return res.status(500).json({ error: err.message });
            }
            res.json({ skillId, ...req.body });
        });
});

app.delete('/github_skills/:skillId', (req, res) => {
    const { skillId } = req.params;
    db.query('DELETE FROM github_skills WHERE skill_id = ?', [skillId], (err, results) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        res.json({ message: 'Skill deleted' });
    });
});

// **GitHub Contributions**
app.get('/github_contributions/:userId', (req, res) => {
    const { userId } = req.params;
    db.query('SELECT * FROM github_contributions WHERE user_id = ?', [userId], (err, results) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        res.json(results);
    });
});

app.post('/github_contributions', (req, res) => {
    const { user_id, repo_name, pr_title, pr_date } = req.body;

    db.query('INSERT INTO github_contributions (user_id, repo_name, pr_title, pr_date) VALUES (?, ?, ?, ?)',
        [user_id, repo_name, pr_title, pr_date],
        (err, results) => {
            if (err) {
                console.error('Error inserting contribution:', err);
                return res.status(500).json({ error: err.message });
            }
            res.json({ id: results.insertId, ...req.body });
        });
});

app.put('/github_contributions/:contributionId', (req, res) => {
    const { contributionId } = req.params;
    const { user_id, repo_name, pr_title, pr_date } = req.body;

    db.query('UPDATE github_contributions SET user_id = ?, repo_name = ?, pr_title = ?, pr_date = ? WHERE contribution_id = ?',
        [user_id, repo_name, pr_title, pr_date, contributionId],
        (err, results) => {
            if (err) {
                return res.status(500).json({ error: err.message });
            }
            res.json({ contributionId, ...req.body });
        });
});

app.delete('/github_contributions/:contributionId', (req, res) => {
    const { contributionId } = req.params;
    db.query('DELETE FROM github_contributions WHERE contribution_id = ?', [contributionId], (err, results) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        res.json({ message: 'Contribution deleted' });
    });
});

// ML Endpoints
app.post('/api/ml/train', async (req, res) => {
    try {
        const { historicalData } = req.body;
        const result = await mlService.trainRacePredictionModel(historicalData);
        res.json(result);
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.post('/api/ml/predict', async (req, res) => {
    try {
        const { raceData } = req.body;
        const result = await mlService.predictRaceOutcome(raceData);
        res.json(result);
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.get('/api/ml/analyze-driver/:driverId', async (req, res) => {
    try {
        const { driverId } = req.params;
        
        // Fetch driver's race history
        db.query('SELECT * FROM race_results WHERE driver_id = ?', [driverId], async (err, results) => {
            if (err) {
                return res.status(500).json({ error: err.message });
            }
            
            const analysis = await mlService.analyzeDriverPerformance(results);
            res.json(analysis);
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Protected route middleware
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: 'Access token required' });
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(403).json({ error: 'Invalid token' });
        }
        req.user = user;
        next();
    });
};

// Example protected route
app.get('/api/protected', authenticateToken, (req, res) => {
    res.json({ message: 'Protected route accessed successfully', user: req.user });
});

// Start the server
app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});