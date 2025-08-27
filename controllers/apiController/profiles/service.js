const { validateWorkType } = require('./functions');

async function insertProfile(profileData, connection) {
  try {
    await validateWorkType(profileData.work_type);

    const query = `
      INSERT INTO Profiles (profile_id, user_id, work_type, skill, website, portfolio_path)
      VALUES (?, ?, ?, ?, ?, ?)
    `;

    const [result] = await connection.execute(query, [
      profileData.profile_id,
      profileData.user_id,
      profileData.work_type,
      profileData.skill,
      profileData.website,
      profileData.portfolio_path
    ]);

    if (result.affectedRows === 0) throw new Error('Failed to insert profile');

    const [rows] = await connection.execute(
      `SELECT * FROM Profiles WHERE profile_id = ?`,
      [profileData.profile_id]
    );

    if (rows.length === 0) throw new Error('Failed to retrieve inserted profile');

    return rows[0];
  } catch (err) {
    console.error('Service error (insertProfile):', err.message);
    throw err;
  }
}

async function insertBank(bankData, connection) {
  try {
    const query = `
      INSERT INTO Bank_info (bank_id, profile_id, bank_name, bank_account, bank_img)
      VALUES (?, ?, ?, ?, ?)
    `;

    const [result] = await connection.execute(query, [
      bankData.bank_id,
      bankData.profile_id,
      bankData.bank_name,
      bankData.bank_account,
      bankData.bank_img
    ]);

    if (result.affectedRows === 0) throw new Error('Failed to insert bank info');

    const [rows] = await connection.execute(
      `SELECT * FROM Bank_info WHERE bank_id = ?`,
      [bankData.bank_id]
    );

    if (rows.length === 0) throw new Error('Failed to retrieve inserted bank info');

    return rows[0];
  } catch (err) {
    console.error('Service error (insertBank):', err.message);
    throw err;
  }
}

async function insertPersonalCard(cardData, connection) {
  try {
    const query = `
      INSERT INTO Personal_cards 
      (card_id, profile_id, card_number, card_first_name, card_last_name, card_address, card_nationality, card_religion, card_birth_date, card_issue_date, card_expiration_date, card_front_img)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const [result] = await connection.execute(query, [
      cardData.card_id,
      cardData.profile_id,
      cardData.card_number,
      cardData.card_first_name,
      cardData.card_last_name,
      cardData.card_address || null,
      cardData.card_nationality || null,
      cardData.card_religion || null,
      cardData.card_birth_date || null,
      cardData.card_issue_date || null,
      cardData.card_expiration_date || null,
      cardData.card_front_img || null
    ]);

    if (result.affectedRows === 0) throw new Error('Failed to insert personal card');

    const [rows] = await connection.execute(
      `SELECT * FROM Personal_cards WHERE card_id = ?`,
      [cardData.card_id]
    );

    return rows[0];
  } catch (err) {
    console.error('Service error (insertPersonalCard):', err.message);
    throw err;
  }
}

async function insertPassport(passportData, connection) {
  try {
    const query = `
      INSERT INTO Passports
      (passport_id, profile_id, passport_format, passport_number, passport_first_name, passport_last_name, passport_gender, passport_country_code, passport_birth_date, passport_expiration_date, mrz, passport_img)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const [result] = await connection.execute(query, [
      passportData.passport_id,
      passportData.profile_id,
      passportData.passport_format || null,
      passportData.passport_number || null,
      passportData.passport_first_name || null,
      passportData.passport_last_name || null,
      passportData.passport_gender || null,
      passportData.passport_country_code || null,
      passportData.passport_birth_date || null,
      passportData.passport_expiration_date || null,
      passportData.mrz || null,
      passportData.passport_img || null
    ]);

    if (result.affectedRows === 0) throw new Error('Failed to insert passport');

    const [rows] = await connection.execute(
      `SELECT * FROM Passports WHERE passport_id = ?`,
      [passportData.passport_id]
    );

    return rows[0];
  } catch (err) {
    console.error('Service error (insertPassport):', err.message);
    throw err;
  }
}

module.exports = { insertProfile, insertBank, insertPersonalCard, insertPassport };