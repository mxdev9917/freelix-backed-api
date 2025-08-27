const { writePool, readPool } = require('../../db/connection');
const errors = require('../../utils/errors');
const uuid = require('../../utils/uuid');

exports.createRole = async (req, res, next) => {
  const { role_name } = req.body;
  const role_id = uuid.generatesUUID();
  
  try {
    if (!role_name || typeof role_name !== 'string') {
      return errors.mapError(400, 'Role name is required and must be a string', next);
    }

    const sql = `INSERT INTO Roles (role_id, role_name) VALUES (?, ?)`;
    await writePool.query(sql, [role_id, role_name]);
    
    return res.status(201).json({
      status: 201,
      message: 'Successfully created role',
      data: { role_id, role_name }
    });
  } catch (error) {
    console.error('Error creating role:', error.message);
    return errors.mapError(500, 'Internal server error', next);
  }
};

exports.fetchRole = async (req, res, next) => {
  try {
    const sql = `SELECT role_id, role_name FROM Roles`;
    const [rows] = await readPool.query(sql);
    
    return res.status(200).json({
      status: 200,
      message: 'Successfully fetched roles',
      data: rows
    });
  } catch (error) {
    console.error('Error fetching roles:', error.message);
    return errors.mapError(500, 'Error fetching roles', next);
  }
};

exports.fetchRoleById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const sql = `SELECT role_id, role_name FROM Roles WHERE role_id = ?`;
    const [rows] = await readPool.query(sql, [id]);

    if (rows.length === 0) {
      return errors.mapError(404, 'Role not found', next);
    }

    return res.status(200).json({
      status: 200,
      message: 'Successfully fetched role',
      data: rows[0]
    });
  } catch (error) {
    console.error('Error fetching role:', error.message);
    return errors.mapError(500, 'Internal server error', next);
  }
};

exports.updateRole = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { role_name } = req.body;

    if (!role_name || typeof role_name !== 'string') {
      return errors.mapError(400, 'Role name is required and must be a string', next);
    }

    const checkSql = `SELECT role_id FROM Roles WHERE role_id = ?`;
    const [checkRows] = await readPool.query(checkSql, [id]);

    if (checkRows.length === 0) {
      return errors.mapError(404, 'Role not found', next);
    }

    const updateSql = `UPDATE Roles SET role_name = ? WHERE role_id = ?`;
    await writePool.query(updateSql, [role_name, id]);

    return res.status(200).json({
      status: 200,
      message: 'Successfully updated role',
      data: { role_id: id, role_name }
    });
  } catch (error) {
    console.error('Error updating role:', error.message);
    return errors.mapError(500, 'Internal server error', next);
  }
};

exports.deleteRole = async (req, res, next) => {
  try {
    const { id } = req.params;

    const checkSql = `SELECT role_id FROM Roles WHERE role_id = ?`;
    const [checkRows] = await readPool.query(checkSql, [id]);

    if (checkRows.length === 0) {
      return errors.mapError(404, 'Role not found', next);
    }

    const deleteSql = `DELETE FROM Roles WHERE role_id = ?`;
    await writePool.query(deleteSql, [id]);

    return res.status(200).json({
      status: 200,
      message: 'Successfully deleted role'
    });
  } catch (error) {
    console.error('Error deleting role:', error.message);
    return errors.mapError(500, 'Internal server error', next);
  }
};