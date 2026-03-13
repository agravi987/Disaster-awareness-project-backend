/**
 * controllers/quizController.js - Quiz Management
 * 
 * Teachers: create, edit, delete, assign quizzes to students/groups.
 * Students: view assigned quizzes, submit answers, view scores.
 */

const Quiz = require('../models/Quiz');
const Group = require('../models/Group');
const User = require('../models/User');
const Groq = require('groq-sdk');

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

/** @desc Create a new quiz | @route POST /api/quizzes | @access Teacher */
const createQuiz = async (req, res) => {
    const { title, description, questions } = req.body;
    try {
        const quiz = await Quiz.create({
            title,
            description,
            questions: questions || [],
            teacher: req.user._id,
        });
        res.status(201).json(quiz);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

/** @desc Get all quizzes (teacher sees all, student sees assigned) | @route GET /api/quizzes | @access Private */
const getAllQuizzes = async (req, res) => {
    try {
        let quizzes;
        if (req.user.role === 'teacher') {
            // Teachers see only their own quizzes
            quizzes = await Quiz.find({ teacher: req.user._id }).populate(
                'assignedStudents',
                'name email'
            );
        } else {
            // Students see quizzes assigned to them directly OR via a group
            const groups = await Group.find({ students: req.user._id });
            const groupIds = groups.map((g) => g._id);

            quizzes = await Quiz.find({
                $or: [
                    { assignedStudents: req.user._id },
                    { assignedGroups: { $in: groupIds } },
                ],
            });
        }
        res.json(quizzes);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

/** @desc Get single quiz by ID | @route GET /api/quizzes/:id | @access Private */
const getQuizById = async (req, res) => {
    try {
        const quiz = await Quiz.findById(req.params.id)
            .populate('assignedStudents', 'name email')
            .populate('assignedGroups', 'name');
        if (!quiz) return res.status(404).json({ message: 'Quiz not found' });
        res.json(quiz);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

/** @desc Update quiz | @route PUT /api/quizzes/:id | @access Teacher */
const updateQuiz = async (req, res) => {
    const { title, description, questions } = req.body;
    try {
        const quiz = await Quiz.findById(req.params.id);
        if (!quiz) return res.status(404).json({ message: 'Quiz not found' });

        if (title) quiz.title = title;
        if (description !== undefined) quiz.description = description;
        if (questions) quiz.questions = questions;

        const updated = await quiz.save();
        res.json(updated);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

/** @desc Delete quiz | @route DELETE /api/quizzes/:id | @access Teacher */
const deleteQuiz = async (req, res) => {
    try {
        const quiz = await Quiz.findById(req.params.id);
        if (!quiz) return res.status(404).json({ message: 'Quiz not found' });
        await quiz.deleteOne();
        res.json({ message: 'Quiz deleted' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

/**
 * @desc    Assign a quiz to students or groups
 * @route   POST /api/quizzes/:id/assign
 * @access  Teacher
 * @body    { studentIds: [...], groupIds: [...] }
 */
const assignQuiz = async (req, res) => {
    let { studentIds, groupIds } = req.body;
    try {
        const quiz = await Quiz.findById(req.params.id);
        if (!quiz) return res.status(404).json({ message: 'Quiz not found' });

        const Group = require('../models/Group');
        let allStudentIdsToAssign = new Set();
        let allGroupIdsToAssign = new Set();

        // 1. Explicitly provided student IDs
        if (studentIds) {
            if (!Array.isArray(studentIds)) studentIds = [studentIds];
            studentIds.forEach((id) => allStudentIdsToAssign.add(id));
        }

        // 2. Add explicitly provided group IDs and extract their student IDs
        if (groupIds) {
            if (!Array.isArray(groupIds)) groupIds = [groupIds];
            if (groupIds.length > 0) {
                const groups = await Group.find({ _id: { $in: groupIds } });
                groups.forEach(group => {
                    allGroupIdsToAssign.add(group._id.toString());
                    group.students.forEach(studentId => {
                        allStudentIdsToAssign.add(studentId.toString());
                    });
                });
            }
        }

        // Add to existing assigned sets
        const existingStudents = quiz.assignedStudents.map((id) => id.toString());
        allStudentIdsToAssign.forEach((id) => {
            if (!existingStudents.includes(id)) quiz.assignedStudents.push(id);
        });

        const existingGroups = quiz.assignedGroups.map((id) => id.toString());
        allGroupIdsToAssign.forEach((id) => {
            if (!existingGroups.includes(id)) quiz.assignedGroups.push(id);
        });

        await quiz.save();
        res.json({ message: 'Quiz assigned successfully', quiz });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

/**
 * @desc    Submit quiz answers (student)
 * @route   POST /api/quizzes/:id/submit
 * @access  Student
 * @body    { answers: [0, 2, 1, ...] }  (array of selected option indices)
 */
const submitQuiz = async (req, res) => {
    const { answers } = req.body;
    try {
        const quiz = await Quiz.findById(req.params.id);
        if (!quiz) return res.status(404).json({ message: 'Quiz not found' });

        // Check if this student already submitted
        const alreadySubmitted = quiz.submissions.find(
            (s) => s.student.toString() === req.user._id.toString()
        );
        if (alreadySubmitted) {
            return res.status(400).json({ message: 'You have already submitted this quiz' });
        }

        // Calculate score by comparing submitted answers to correct answers
        let score = 0;
        quiz.questions.forEach((question, index) => {
            if (answers[index] === question.correctAnswerIndex) {
                score += 1;
            }
        });

        // Record the submission
        quiz.submissions.push({
            student: req.user._id,
            answers,
            score,
        });
        await quiz.save();

        res.json({
            message: 'Quiz submitted successfully',
            score,
            total: quiz.questions.length,
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

/**
 * @desc    Get submission result for the current student
 * @route   GET /api/quizzes/:id/result
 * @access  Student
 */
const getMyResult = async (req, res) => {
    try {
        const quiz = await Quiz.findById(req.params.id);
        if (!quiz) return res.status(404).json({ message: 'Quiz not found' });

        const submission = quiz.submissions.find(
            (s) => s.student.toString() === req.user._id.toString()
        );

        if (!submission) {
            return res.status(404).json({ message: 'No submission found' });
        }

        res.json({ submission, total: quiz.questions.length });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

/**
 * @desc    Get all student attempts for a quiz (teacher view)
 * @route   GET /api/quizzes/:id/attempts
 * @access  Teacher
 */
const getQuizAttempts = async (req, res) => {
    try {
        const quiz = await Quiz.findById(req.params.id)
            .populate('submissions.student', 'name email');
        if (!quiz) return res.status(404).json({ message: 'Quiz not found' });

        const attempts = quiz.submissions.map((s) => ({
            studentId:    s.student?._id,
            studentName:  s.student?.name  || 'Unknown',
            studentEmail: s.student?.email || 'Unknown',
            score:        s.score,
            total:        quiz.questions.length,
            percentage:   quiz.questions.length > 0
                ? Math.round((s.score / quiz.questions.length) * 100)
                : 0,
            submittedAt: s.submittedAt,
        }));

        res.json({ quizTitle: quiz.title, attempts });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

/**
 * @desc    Generate quiz questions using AI (Groq)
 * @route   POST /api/quizzes/generate
 * @access  Teacher
 * @body    { topic: "Earthquakes", count: 3 }
 */
const generateQuizAI = async (req, res) => {
    const { topic, count } = req.body;
    
    if (!topic || !count) {
        return res.status(400).json({ message: 'Please provide a topic and question count' });
    }

    try {
        const prompt = `Generate a multiple-choice quiz about ${topic} with exactly ${count} questions. 
Respond ONLY with a valid JSON array of objects, with no markdown formatting, no backticks, and no extra text.
Each object must have the following structure:
{
  "questionText": "The question string",
  "options": ["Option 1", "Option 2", "Option 3", "Option 4"],
  "correctAnswerIndex": 0 // The 0-based integer index of the correct option
}`;

        const chatCompletion = await groq.chat.completions.create({
            messages: [{ role: 'user', content: prompt }],
            model: 'openai/gpt-oss-120b',
            temperature: 0.7,
        });

        const content = chatCompletion.choices[0]?.message?.content || '[]';
        
        // Sometimes LLMs still add backticks or markdown even when told not to. 
        // We'll try to clean it up before parsing.
        let cleanContent = content.trim();
        if (cleanContent.startsWith('\`\`\`json')) {
            cleanContent = cleanContent.replace(/^\`\`\`json\n/, '').replace(/\n\`\`\`$/, '');
        } else if (cleanContent.startsWith('\`\`\`')) {
            cleanContent = cleanContent.replace(/^\`\`\`\n/, '').replace(/\n\`\`\`$/, '');
        }

        const questions = JSON.parse(cleanContent);
        res.json(questions);

    } catch (error) {
        console.error('Groq AI generation error:', error);
        res.status(500).json({ message: 'Failed to generate quiz with AI. Ensure your API key is correct.' });
    }
};

module.exports = {
    createQuiz,
    getAllQuizzes,
    getQuizById,
    updateQuiz,
    deleteQuiz,
    assignQuiz,
    submitQuiz,
    getMyResult,
    getQuizAttempts,
    generateQuizAI,
};
