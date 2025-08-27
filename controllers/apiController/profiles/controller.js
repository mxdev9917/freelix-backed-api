const { insertProfile, insertBank, insertPersonalCard, insertPassport } = require('./service');
const { portfolioFile, bankFile, personalFile, passportFile } = require('./functions');
const generateUUID = require('../../../utils/uuid');
const { writePool } = require('../../../db/connection');

async function createProfile(req, res) {
  const connection = await writePool.getConnection();
  try {
    await connection.beginTransaction();

    const formData = req.body;

    // Validate work_type early
    const validWorkTypes = ['full-time', 'part-time'];
    if (!formData.work_type || !validWorkTypes.includes(formData.work_type.toLowerCase())) {
      return res.status(400).json({
        success: false,
        message: 'Invalid work_type. Must be one of: full-time, part-time',
      });
    }

    // Validate required fields
    if (!formData.user_id) {
      return res.status(400).json({
        success: false,
        message: 'user_id is required',
      });
    }

    const profileData = {
      profile_id: generateUUID(),
      user_id: formData.user_id,
      work_type: formData.work_type.toLowerCase(),
      skill: formData.skill || null,
      website: formData.website || null,
      portfolio_path: await portfolioFile(req.files['portfolio_path']?.[0]) || null,
    };
    const newProfile = await insertProfile(profileData, connection);

    const bankData = {
      bank_id: generateUUID(),
      profile_id: newProfile.profile_id,
      bank_name: formData.bank_name || null,
      bank_account: formData.bank_account || null,
      bank_img: await bankFile(req.files['bank_img']?.[0]) || null,
    };
    await insertBank(bankData, connection);

    // Determine which identification to use based on what's provided
    let identificationData = null;
    let identificationType = null;
    
    if (formData.card_number || req.files['card_front_img']?.[0]) {
      // Insert personal card if card number or image is provided
      const personalCardData = {
        card_id: generateUUID(),
        profile_id: newProfile.profile_id,
        card_number: formData.card_number || null,
        card_first_name: formData.card_first_name || null,
        card_last_name: formData.card_last_name || null,
        card_address: formData.card_address || null,
        card_nationality: formData.card_nationality || null,
        card_religion: formData.card_religion || null,
        card_birth_date: formData.card_birth_date || null,
        card_issue_date: formData.card_issue_date || null,
        card_expiration_date: formData.card_expiration_date || null,
        card_front_img: await personalFile(req.files['card_front_img']?.[0]) || null,
      };
      await insertPersonalCard(personalCardData, connection);
      identificationType = 'personalCard';
    } 
    
    if (formData.passport_number || req.files['passport_img']?.[0]) {
      // Insert passport if passport number or image is provided
      const passportData = {
        passport_id: generateUUID(),
        profile_id: newProfile.profile_id,
        passport_format: formData.passport_format || null,
        passport_number: formData.passport_number || null,
        passport_first_name: formData.passport_first_name || null,
        passport_last_name: formData.passport_last_name || null,
        passport_gender: formData.passport_gender || null,
        passport_country_code: formData.passport_country_code || null,
        passport_birth_date: formData.passport_birth_date || null,
        passport_expiration_date: formData.passport_expiration_date || null,
        mrz: formData.mrz || null,
        passport_img: await passportFile(req.files['passport_img']?.[0]) || null,
      };
      await insertPassport(passportData, connection);
      identificationType = 'passport';
    }

    // Get the complete joined data
    const [completeProfile] = await connection.execute(`
      SELECT p.*, 
             b.bank_id, b.bank_name, b.bank_account, b.bank_img,
             pc.card_id, pc.card_number, pc.card_first_name, pc.card_last_name, 
             pc.card_address, pc.card_nationality, pc.card_religion, 
             pc.card_birth_date, pc.card_issue_date, pc.card_expiration_date, pc.card_front_img,
             ps.passport_id, ps.passport_format, ps.passport_number, ps.passport_first_name, 
             ps.passport_last_name, ps.passport_gender, ps.passport_country_code, 
             ps.passport_birth_date, ps.passport_expiration_date, ps.mrz, ps.passport_img
      FROM Profiles p
      LEFT JOIN Bank_info b ON p.profile_id = b.profile_id
      LEFT JOIN Personal_cards pc ON p.profile_id = pc.profile_id
      LEFT JOIN Passports ps ON p.profile_id = ps.profile_id
      WHERE p.profile_id = ?
    `, [newProfile.profile_id]);

    if (completeProfile.length === 0) throw new Error('Failed to retrieve complete profile');

    const profile = completeProfile[0];
    
    // Format the response based on which identification type was used
    const responseData = {
      profile: {
        profile_id: profile.profile_id,
        user_id: profile.user_id,
        work_type: profile.work_type,
        skill: profile.skill,
        website: profile.website,
        portfolio_path: profile.portfolio_path
      },
      bank: {
        bank_id: profile.bank_id,
        bank_name: profile.bank_name,
        bank_account: profile.bank_account,
        bank_img: profile.bank_img
      }
    };

    // Add only one identification type based on what was inserted
    if (profile.card_id) {
      responseData.personalCard = {
        card_id: profile.card_id,
        card_number: profile.card_number,
        card_first_name: profile.card_first_name,
        card_last_name: profile.card_last_name,
        card_address: profile.card_address,
        card_nationality: profile.card_nationality,
        card_religion: profile.card_religion,
        card_birth_date: profile.card_birth_date,
        card_issue_date: profile.card_issue_date,
        card_expiration_date: profile.card_expiration_date,
        card_front_img: profile.card_front_img
      };
    } 
    
    if (profile.passport_id) {
      responseData.passport = {
        passport_id: profile.passport_id,
        passport_format: profile.passport_format,
        passport_number: profile.passport_number,
        passport_first_name: profile.passport_first_name,
        passport_last_name: profile.passport_last_name,
        passport_gender: profile.passport_gender,
        passport_country_code: profile.passport_country_code,
        passport_birth_date: profile.passport_birth_date,
        passport_expiration_date: profile.passport_expiration_date,
        mrz: profile.mrz,
        passport_img: profile.passport_img
      };
    }

    await connection.commit();

    res.status(201).json({
      success: true,
      message: 'Profile created successfully',
      data: responseData,
    });
  } catch (err) {
    await connection.rollback();
    console.error('Profile creation error:', err.message);

    if (err.message.includes('work_type must be one of')) {
      return res.status(400).json({
        success: false,
        message: err.message,
      });
    }

    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined,
    });
  } finally {
    connection.release();
  }
}

module.exports = { createProfile };