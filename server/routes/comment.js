const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { check, validationResult } = require('express-validator');
const Task = require('../models/Task');
const Comment = require('../models/Comment');

// @route   POST api/comments
// @desc    Add a comment to a task
router.post('/', [
  auth,
  [
    check('text', 'Text is required').not().isEmpty(),
    check('task', 'Task ID is required').not().isEmpty()
  ]
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { text, task } = req.body;

  try {
    // Verify user has access to the task
    const taskDoc = await Task.findById(task).populate('project');
    if (!taskDoc) {
      return res.status(404).json({ msg: 'Task not found' });
    }

    const project = taskDoc.project;
    const isMember = project.members.some(member => 
      member.toString() === req.user.id || 
      (member._id && member._id.toString() === req.user.id)
    );

    if (!isMember && project.createdBy.toString() !== req.user.id) {
      return res.status(401).json({ msg: 'Not authorized' });
    }

    const comment = new Comment({
      text,
      task,
      user: req.user.id
    });

    await comment.save();
    
    // Emit real-time update
    req.io.to(task).emit('comment_added', comment);
    
    res.json(comment);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// @route   GET api/comments/task/:taskId
// @desc    Get all comments for a task
router.get('/task/:taskId', auth, async (req, res) => {
  try {
    const task = await Task.findById(req.params.taskId).populate('project');
    
    if (!task) {
      return res.status(404).json({ msg: 'Task not found' });
    }

    // Check if user has access to the project
    const project = task.project;
    const isMember = project.members.some(member => 
      member.toString() === req.user.id || 
      (member._id && member._id.toString() === req.user.id)
    );

    if (!isMember && project.createdBy.toString() !== req.user.id) {
      return res.status(401).json({ msg: 'Not authorized' });
    }

    const comments = await Comment.find({ task: req.params.taskId })
      .populate('user', 'name')
      .sort({ createdAt: -1 });

    res.json(comments);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

module.exports = router;