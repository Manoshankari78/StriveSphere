const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { check, validationResult } = require('express-validator');
const Project = require('../models/Project');
const User = require('../models/User');

// @route   POST api/projects
// @desc    Create a project
router.post('/', [
  auth,
  [
    check('title', 'Title is required').not().isEmpty(),
    check('description', 'Description is required').not().isEmpty()
  ]
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { title, description, members = [] } = req.body;

  try {
    // Ensure the creator is part of the members array
    const uniqueMembers = Array.from(new Set([...members, req.user.id]));

    const project = new Project({
      title,
      description,
      createdBy: req.user.id,
      members: uniqueMembers
    });

    await project.save();

    // Emit real-time update if socket is available
    if (req.io) {
      req.io.to(project.id).emit('project_created', project);
    }

    res.json(project);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// @route   GET api/projects
// @desc    Get all projects for user
router.get('/', auth, async (req, res) => {
  try {
    const projects = await Project.find({
      $or: [
        { createdBy: req.user.id },
        { members: req.user.id }
      ]
    })
    .populate('createdBy', 'name')
    .populate('members', 'name')
    .sort({ createdAt: -1 });

    res.json(projects);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// @route   GET api/projects/:id
// @desc    Get project by ID
router.get('/:id', auth, async (req, res) => {
  try {
    const project = await Project.findById(req.params.id)
      .populate('createdBy', 'name')
      .populate('members', 'name');

    if (!project) {
      return res.status(404).json({ msg: 'Project not found' });
    }

    // Check if user is creator or member
    const isMember = project.members.some(member => 
      member._id?.toString() === req.user.id
    );
    const isCreator = project.createdBy._id?.toString() === req.user.id;

    if (!isMember && !isCreator) {
      return res.status(401).json({ msg: 'Not authorized' });
    }

    res.json(project);
  } catch (err) {
    console.error(err.message);
    if (err.kind === 'ObjectId') {
      return res.status(404).json({ msg: 'Project not found' });
    }
    res.status(500).send('Server Error');
  }
});

module.exports = router;
