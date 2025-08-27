const express = require('express');
const locationRoutes = express.Router();
const middlewares = require('../middlewares/middleware');
const locationController = require('../controllers/locationService');
const countryCodeController = require('../controllers/countryCodeController'); // Import the new controller

/**
 * @swagger
 * tags:
 *   - name: Location
 *     description: Location data management
 */

/**
 * @swagger
 * /location/country-codes:
 *   get:
 *     summary: Get all country codes
 *     tags: [Location]
 *     responses:
 *       200:
 *         description: List of country codes
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: integer
 *                   example: 200
 *                 message:
 *                   type: string
 *                   example: Successfully fetched country codes
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       country_id:
 *                         type: integer
 *                         example: 1
 *                       country_name:
 *                         type: string
 *                         example: Laos
 *                       country_name_en:
 *                         type: string
 *                         example: Laos
 *                       country_code:
 *                         type: string
 *                         example: LA
 *                       phone_code:
 *                         type: string
 *                         example: +856
 *                       is_active:
 *                         type: boolean
 *                         example: true
 */

/**
 * @swagger
 * /location/province:
 *   get:
 *     summary: Get all provinces
 *     tags: [Location]
 *     responses:
 *       200:
 *         description: List of provinces
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: integer
 *                   example: 200
 *                 message:
 *                   type: string
 *                   example: Successfully fetched provinces
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       pr_id:
 *                         type: integer
 *                         example: 1
 *                       pr_name:
 *                         type: string
 *                         example: Vientiane Capital
 *                       pr_name_en:
 *                         type: string
 *                         example: Vientiane Capital
 */

/**
 * @swagger
 * /location/district/{id}:
 *   get:
 *     summary: Get districts by province ID
 *     tags: [Location]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Province ID
 *     responses:
 *       200:
 *         description: Province with its districts
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: integer
 *                   example: 200
 *                 message:
 *                   type: string
 *                   example: Successfully fetched province with districts
 *                 data:
 *                   type: object
 *                   properties:
 *                     province:
 *                       type: object
 *                       properties:
 *                         pr_id:
 *                           type: integer
 *                           example: 1
 *                         pr_name:
 *                           type: string
 *                           example: Vientiane Capital
 *                         pr_name_en:
 *                           type: string
 *                           example: Vientiane Capital
 *                     districts:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           dr_id:
 *                             type: integer
 *                             example: 10
 *                           dr_name:
 *                             type: string
 *                             example: Chanthabouly
 *                           dr_name_en:
 *                             type: string
 *                             example: Chanthabouly
 */

/**
 * @swagger
 * /location/village/{id}:
 *   get:
 *     summary: Get villages by district ID
 *     tags: [Location]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: District ID
 *     responses:
 *       200:
 *         description: District with its villages
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: integer
 *                   example: 200
 *                 message:
 *                   type: string
 *                   example: Successfully fetched district with villages
 *                 data:
 *                   type: object
 *                   properties:
 *                     district:
 *                       type: object
 *                       properties:
 *                         dr_id:
 *                           type: integer
 *                           example: 10
 *                         dr_name:
 *                           type: string
 *                           example: Chanthabouly
 *                         dr_name_en:
 *                           type: string
 *                           example: Chanthabouly
 *                     villages:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           vill_id:
 *                             type: integer
 *                             example: 101
 *                           vill_name:
 *                             type: string
 *                             example: Phonxay
 *                           vill_name_en:
 *                             type: string
 *                             example: Phonxay
 */


// Validate :id param for any route that contains it
locationRoutes.param('id', (req, res, next, id) => {
  if (!Number.isInteger(Number(id)) || Number(id) <= 0) {
    return res.status(400).json({
      status: 400,
      message: 'Invalid ID parameter'
    });
  }
  next();
});

// Routes
// locationRoutes.route('/country-codes/:phoneCode').get(countryCodeController.getCountryByPhoneCode);
locationRoutes.route('/country-codes').get(countryCodeController.fetchCountryCodes);
locationRoutes.route('/province').get(locationController.fetchProvince);
locationRoutes.route('/district/:id').get(locationController.fetchProvinceWithDistricts);
locationRoutes.route('/village/:id').get(locationController.fetchDistrictWithVillages);

module.exports = locationRoutes;