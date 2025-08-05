const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { check, validationResult } = require('express-validator');
const Project = require('../models/Project');
const Task = require('../models/Task');

// @route   POST api/tasks
// @desc    Create a task
router.post('/', [
  auth,
  [
    check('title', 'Title is required').not().isEmpty(),
    check('project', 'Project ID is required').not().isEmpty()
  ]
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { title, description, project, assignedTo, status, priority, dueDate } = req.body;

  try {
    // Verify user has access to the project
    const projectDoc = await Project.findById(project);
    if (!projectDoc) {
      return res.status(404).json({ msg: 'Project not found' });
    }

    const isMember = projectDoc.members.some(member => 
      member.toString() === req.user.id || 
      (member._id && member._id.toString() === req.user.id)
    );

    if (!isMember && projectDoc.createdBy.toString() !== req.user.id) {
      return res.status(401).json({ msg: 'Not authorized' });
    }

    const task = new Task({
      title,
      description,
      project,
      assignedTo,
      status,
      priority,
      dueDate,
      createdBy: req.user.id
    });

    await task.save();
    
    // Emit real-time update
    req.io.to(project).emit('task_created', task);
    
    res.json(task);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// @route   GET api/tasks/project/:projectId
// @desc    Get all tasks for a project
router.get('/project/:projectId', auth, async (req, res) => {
  try {
    const project = await Project.findById(req.params.projectId);
    
    if (!project) {
      return res.status(404).json({ msg: 'Project not found' });
    }

    // Check if user is member of project
    const isMember = project.members.some(member => 
      member.toString() === req.user.id || 
      (member._id && member._id.toString() === req.user.id)
    );

    if (!isMember && project.createdBy.toString() !== req.user.id) {
      return res.status(401).json({ msg: 'Not authorized' });
    }

    const tasks = await Task.find({ project: req.params.projectId })
      .populate('assignedTo', 'name')
      .populate('createdBy', 'name')
      .sort({ createdAt: -1 });

    res.json(tasks);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// @route   PUT api/tasks/:id
// @desc    Update a task
router.put('/:id', auth, async (req, res) => {
  const { title, description, assignedTo, status, priority, dueDate } = req.body;

  try {
    let task = await Task.findById(req.params.id);

    if (!task) {
      return res.status(404).json({ msg: 'Task not found' });
    }

    // Check if user has access to the project
    const project = await Project.findById(task.project);
    const isMember = project.members.some(member => 
      member.toString() === req.user.id || 
      (member._id && member._id.toString() === req.user.id)
    );

    if (!isMember && project.createdBy.toString() !== req.user.id) {
      return res.status(401).json({ msg: 'Not authorized' });
    }

    task.title = title || task.title;
    task.description = description || task.description;
    task.assignedTo = assignedTo || task.assignedTo;
    task.status = status || task.status;
    task.priority = priority || task.priority;
    task.dueDate = dueDate || task.dueDate;

    await task.save();
    
    // Emit real-time update
    req.io.to(task.project.toString()).emit('task_updated', task);
    
    res.json(task);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

module.exports = router;