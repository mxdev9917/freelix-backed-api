const { readPool } = require('../db/connection');
const errors = require('../utils/errors');

const fetchProvince = async (req, res, next) => {
    try {
        const sql = `SELECT pr_id, pr_name, pr_name_en FROM province ORDER BY pr_name`;
        const [rows] = await readPool.query(sql);
        
        return res.status(200).json({
            status: 200,
            message: 'Successfully fetched provinces',
            data: rows
        });
    } catch (error) {
        console.error('Error fetching provinces:', error.message);
        return errors.mapError(500, 'Internal server error', next);
    }
};

const fetchProvinceWithDistricts = async (req, res, next) => {
    try {
        const { id } = req.params;

        if (!id) {
            return res.status(400).json({
                status: 400,
                message: 'Province ID is required'
            });
        }

        // First get the province details
        const provinceSql = `SELECT pr_id, pr_name, pr_name_en FROM province WHERE pr_id = ?`;
        const [provinceRows] = await readPool.query(provinceSql, [id]);

        if (provinceRows.length === 0) {
            return res.status(404).json({
                status: 404,
                message: 'Province not found'
            });
        }

        // Then get its districts
        const districtsSql = `SELECT dr_id, dr_name, dr_name_en FROM dristric WHERE pr_id = ? ORDER BY dr_name`;
        const [districtRows] = await readPool.query(districtsSql, [id]);

        // Combine the results
        const result = {
            province: provinceRows[0],
            districts: districtRows
        };

        return res.status(200).json({
            status: 200,
            message: 'Successfully fetched province with districts',
            data: result
        });
    } catch (error) {
        console.error('Error fetching province with districts:', error.message);
        return errors.mapError(500, 'Internal server error', next);
    }
};

const fetchDistrictWithVillages = async (req, res, next) => {
    try {
        const { id } = req.params;

        if (!id) {
            return res.status(400).json({
                status: 400,
                message: 'District ID is required'
            });
        }

        // First get the district details
        const districtSql = `SELECT dr_id, dr_name, dr_name_en FROM dristric WHERE dr_id = ?`;
        const [districtRows] = await readPool.query(districtSql, [id]);

        if (districtRows.length === 0) {
            return res.status(404).json({
                status: 404,
                message: 'District not found'
            });
        }

        // Then get its villages
        const villagesSql = `SELECT vill_id, vill_name, vill_name_en FROM village WHERE dr_id = ? ORDER BY vill_name`;
        const [villageRows] = await readPool.query(villagesSql, [id]);

        // Combine the results
        const result = {
            district: districtRows[0],
            villages: villageRows
        };

        return res.status(200).json({
            status: 200,
            message: 'Successfully fetched district with villages',
            data: result
        });
    } catch (error) {
        console.error('Error fetching district with villages:', error.message);
        return errors.mapError(500, 'Internal server error', next);
    }
};

module.exports = {
    fetchProvince,
    fetchProvinceWithDistricts,
    fetchDistrictWithVillages
};
