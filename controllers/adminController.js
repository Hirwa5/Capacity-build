/**
 * controllers/adminController.js
 * System Admin: full CRUD over Users, Departments, Categories,
 * plus high-level workload metrics.
 */
const bcrypt = require('bcryptjs');
const pool = require('../config/db');
const userModel = require('../models/userModel');
const departmentModel = require('../models/departmentModel');
const categoryModel = require('../models/categoryModel');
const requestModel = require('../models/requestModel');

// ---------------------------------------------------------------- Users ----
async function listUsers(req, res) {
  try {
    const users = await userModel.findAll();
    return res.json({ users });
  } catch (err) {
    console.error('listUsers error:', err);
    return res.status(500).json({ error: 'Failed to load users.' });
  }
}

async function createUser(req, res) {
  try {
    const { fullName, email, password, departmentId, roleName } = req.body;
    if (!fullName || !email || !password || !departmentId || !roleName) {
      return res.status(400).json({ error: 'fullName, email, password, departmentId and roleName are required.' });
    }

    const existing = await userModel.findByEmail(email);
    if (existing) return res.status(409).json({ error: 'A user with this email already exists.' });

    const roleResult = await pool.query('SELECT id FROM roles WHERE role_name = $1', [roleName]);
    if (roleResult.rows.length === 0) {
      return res.status(400).json({ error: 'Invalid roleName. Use Requester, Assignee, or Admin.' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await userModel.create({
      fullName, email, passwordHash, departmentId, roleId: roleResult.rows[0].id,
    });
    return res.status(201).json({ user });
  } catch (err) {
    console.error('createUser error:', err);
    return res.status(500).json({ error: 'Failed to create user.' });
  }
}

async function updateUser(req, res) {
  try {
    const { fullName, email, departmentId, roleName, isActive } = req.body;
    let roleId = null;
    if (roleName) {
      const roleResult = await pool.query('SELECT id FROM roles WHERE role_name = $1', [roleName]);
      if (roleResult.rows.length === 0) {
        return res.status(400).json({ error: 'Invalid roleName.' });
      }
      roleId = roleResult.rows[0].id;
    }

    const updated = await userModel.update(req.params.id, {
      fullName, email, departmentId, roleId, isActive,
    });
    if (!updated) return res.status(404).json({ error: 'User not found.' });
    return res.json({ user: updated });
  } catch (err) {
    console.error('updateUser error:', err);
    return res.status(500).json({ error: 'Failed to update user.' });
  }
}

async function deactivateUser(req, res) {
  try {
    const updated = await userModel.deactivate(req.params.id);
    if (!updated) return res.status(404).json({ error: 'User not found.' });
    return res.json({ user: updated });
  } catch (err) {
    console.error('deactivateUser error:', err);
    return res.status(500).json({ error: 'Failed to deactivate user.' });
  }
}

async function deleteUser(req, res) {
  try {
    await userModel.remove(req.params.id);
    return res.status(204).send();
  } catch (err) {
    console.error('deleteUser error:', err);
    return res.status(500).json({ error: 'Failed to delete user.' });
  }
}

// --------------------------------------------------------- Departments ----
async function listDepartments(req, res) {
  try {
    const departments = await departmentModel.findAll();
    return res.json({ departments });
  } catch (err) {
    console.error('listDepartments error:', err);
    return res.status(500).json({ error: 'Failed to load departments.' });
  }
}

async function createDepartment(req, res) {
  try {
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: 'name is required.' });
    const department = await departmentModel.create(name);
    return res.status(201).json({ department });
  } catch (err) {
    console.error('createDepartment error:', err);
    return res.status(500).json({ error: 'Failed to create department.' });
  }
}

async function updateDepartment(req, res) {
  try {
    const updated = await departmentModel.update(req.params.id, req.body.name);
    if (!updated) return res.status(404).json({ error: 'Department not found.' });
    return res.json({ department: updated });
  } catch (err) {
    console.error('updateDepartment error:', err);
    return res.status(500).json({ error: 'Failed to update department.' });
  }
}

async function deleteDepartment(req, res) {
  try {
    await departmentModel.remove(req.params.id);
    return res.status(204).send();
  } catch (err) {
    console.error('deleteDepartment error:', err);
    return res.status(500).json({ error: 'Failed to delete department.' });
  }
}

// ---------------------------------------------------------- Categories ----
async function listCategories(req, res) {
  try {
    const categories = await categoryModel.findAll();
    return res.json({ categories });
  } catch (err) {
    console.error('listCategories error:', err);
    return res.status(500).json({ error: 'Failed to load categories.' });
  }
}

async function createCategory(req, res) {
  try {
    const { departmentId, categoryName, description } = req.body;
    if (!departmentId || !categoryName) {
      return res.status(400).json({ error: 'departmentId and categoryName are required.' });
    }
    const category = await categoryModel.create({ departmentId, categoryName, description });
    return res.status(201).json({ category });
  } catch (err) {
    console.error('createCategory error:', err);
    return res.status(500).json({ error: 'Failed to create category.' });
  }
}

async function updateCategory(req, res) {
  try {
    const { categoryName, description, departmentId } = req.body;
    const updated = await categoryModel.update(req.params.id, { categoryName, description, departmentId });
    if (!updated) return res.status(404).json({ error: 'Category not found.' });
    return res.json({ category: updated });
  } catch (err) {
    console.error('updateCategory error:', err);
    return res.status(500).json({ error: 'Failed to update category.' });
  }
}

async function deleteCategory(req, res) {
  try {
    await categoryModel.remove(req.params.id);
    return res.status(204).send();
  } catch (err) {
    console.error('deleteCategory error:', err);
    return res.status(500).json({ error: 'Failed to delete category.' });
  }
}

// -------------------------------------------------------------- Metrics ---
async function overview(req, res) {
  try {
    const [systemMetrics, byDepartment] = await Promise.all([
      requestModel.systemMetrics(),
      departmentModel.workloadOverview(),
    ]);
    return res.json({ systemMetrics, byDepartment });
  } catch (err) {
    console.error('overview error:', err);
    return res.status(500).json({ error: 'Failed to load system overview.' });
  }
}

module.exports = {
  listUsers, createUser, updateUser, deactivateUser, deleteUser,
  listDepartments, createDepartment, updateDepartment, deleteDepartment,
  listCategories, createCategory, updateCategory, deleteCategory,
  overview,
};
