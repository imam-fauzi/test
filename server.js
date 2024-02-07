// server.js
const express = require('express');
const bodyParser = require('body-parser');
const { Pool } = require('pg');

const app = express();
const port = 3000;

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

const pool = new Pool({
    user: 'muhamadimamfauzi',
    host: 'localhost',
    database: 'imam_test',
    password: 'postgres',
    port: 5432,
});

// Route for CV List Page
app.get('/', async (req, res) => {
    try {
        const cvList = await generateCVList();
        res.send(`
            <h1>CV List</h1>
            <table border="1">
                <thead>
                    <tr>
                        <th>Full Name</th>
                        <th>Email</th>
                        <th>Experience</th>
                        <th>Skills</th>
                        <th>Action</th>
                    </tr>
                </thead>
                <tbody>
                    ${cvList}
                </tbody>
            </table>
            <br>
            <a href="/form">Add New CV</a>
        `);
    } catch (error) {
        console.error('Error generating CV list:', error.stack);
        res.send('Failed to load CV list');
    }
});

// Generate CV List
async function generateCVList() {
    try {
        const query = `
            SELECT cv_table.*, users.full_name, users.email
            FROM cv_table
            JOIN users ON cv_table.user_id = users.user_id
        `;
        const result = await pool.query(query);
        let rows = '';
        result.rows.forEach((cv) => {
            const experienceFormatted = formatExperience(cv.experience);
            const skillsFormatted = formatSkills(cv.skills);
            rows += `
                <tr>
                    <td>${cv.full_name}</td>
                    <td>${cv.email}</td>
                    <td>${experienceFormatted}</td>
                    <td>${skillsFormatted}</td>
                    <td><a href="/edit/${cv.cv_id}">Edit</a></td>
                </tr>
            `;
        });
        return rows;
    } catch (error) {
        throw error;
    }
}

// Format Experience
function formatExperience(experience) {
    // Implement your formatting logic here
    // For example, you can split the string into separate lines
    const formattedExperience = experience.split('\n').map(line => `- ${line}`).join('<br>');
    return formattedExperience;
}

// Format Skills
function formatSkills(skills) {
    // Implement your formatting logic here
    // For example, you can split the string into separate lines
    const formattedSkills = skills.split(',').map(skill => `<li>${skill.trim()}</li>`).join('');
    return `<ul>${formattedSkills}</ul>`;
}

// Route for Editing CV
app.get('/edit/:cv_id', async (req, res) => {
    const cv_id = req.params.cv_id;
    try {
        const cv = await getCVById(cv_id);
        if (!cv) {
            return res.send('CV not found');
        }
        res.send(`
            <h1>Edit CV</h1>
            <form action="/update/${cv_id}" method="post">
                <label for="full_name">Full Name:</label>
                <input type="text" id="full_name" name="full_name" value="${cv.full_name}"><br><br>
                <label for="email">Email:</label>
                <input type="email" id="email" name="email" value="${cv.email}"><br><br>
                <label for="experience">Working Experiences:</label>
                <textarea id="experience" name="experience">${cv.experience}</textarea><br><br>
                <label for="skills">Tech Skills:</label>
                <input type="text" id="skills" name="skills" value="${cv.skills}"><br><br>
                <input type="submit" value="Update">
            </form>
        `);
    } catch (error) {
        console.error('Error fetching CV for editing:', error.stack);
        res.send('Failed to load CV for editing');
    }
});

// Function to Get CV by ID
async function getCVById(cv_id) {
    try {
        const query = `
            SELECT cv_table.*, users.full_name, users.email
            FROM cv_table
            JOIN users ON cv_table.user_id = users.user_id
            WHERE cv_id = $1
        `;
        const result = await pool.query(query, [cv_id]);
        return result.rows[0];
    } catch (error) {
        throw error;
    }
}

// Route to Handle CV Update
app.post('/update/:cv_id', async (req, res) => {
    const cv_id = req.params.cv_id;
    const { full_name, email, experience, skills } = req.body;
    try {
        // Update data in 'users' table first
        const updateUserQuery = `
            UPDATE users
            SET full_name = $1, email = $2
            FROM cv_table
            WHERE cv_table.user_id = users.user_id AND cv_table.cv_id = $3
        `;
        const userValues = [full_name, email, cv_id];
        await pool.query(updateUserQuery, userValues);

        // Update data in 'cv_table' table
        const updateCVQuery = `
            UPDATE cv_table
            SET experience = $1, skills = $2
            WHERE cv_id = $3
        `;
        const cvValues = [experience, skills, cv_id];
        await pool.query(updateCVQuery, cvValues);

        res.send('CV updated successfully');
    } catch (error) {
        console.error('Error updating CV:', error.stack);
        res.send('Failed to update CV');
    }
});

// Route for CV Form Page
app.get('/form', (req, res) => {
    res.send(`
    <h1>CV Form Page</h1>
    <form action="/submit" method="post">
        <label for="full_name">Full Name:</label>
        <input type="text" id="full_name" name="full_name"><br><br>
        <label for="email">Email:</label>
        <input type="email" id="email" name="email"><br><br>
        <label for="experience">Working Experiences:</label>
        <textarea id="experience" name="experience"></textarea><br><br>
        <label for="skills">Tech Skills:</label>
        <input type="text" id="skills" name="skills"><br><br>
        <input type="submit" value="Submit">
    </form>
    `);
});

// Route to Handle CV Form Submission
app.post('/submit', async (req, res) => {
    const { full_name, email, experience, skills } = req.body;

    try {
        // Insert into 'users' table first to get the 'user_id'
        const userQuery = 'INSERT INTO users (full_name, email) VALUES ($1, $2) RETURNING user_id';
        const userValues = [full_name, email];
        const userResult = await pool.query(userQuery, userValues);
        const user_id = userResult.rows[0].user_id;

        // Insert into 'cv_table' with the obtained 'user_id'
        const cvQuery = 'INSERT INTO cv_table (user_id, experience, skills) VALUES ($1, $2, $3)';
        const cvValues = [user_id, experience, skills];
        await pool.query(cvQuery, cvValues);

        res.send('CV submitted successfully');
    } catch (error) {
        console.error('Error submitting CV:', error.stack);
        res.send('Failed to submit CV');
    }
});

// Start server
app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});
