-- 1. Admin Roles
CREATE TABLE Roles (
    role_id CHAR(60) NOT NULL,
    role_name VARCHAR(30) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (role_id),
    UNIQUE (role_name),
    INDEX (role_name)
);

-- 2. Admins
CREATE TABLE Admins (
    admin_id CHAR(60) NOT NULL,
    role_id CHAR(60) NOT NULL,
    admin_name VARCHAR(30) NOT NULL,
    admin_email VARCHAR(50) NOT NULL,
    admin_password VARCHAR(255) NOT NULL,
    admin_status BOOLEAN NOT NULL DEFAULT TRUE, -- stored as TINYINT(1)
    admin_img VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (admin_id),
    FOREIGN KEY (role_id) REFERENCES Roles(role_id) ON DELETE CASCADE,
    UNIQUE (admin_email),
    INDEX (admin_name),
    INDEX (admin_email)
);

-- 3. Users
CREATE TABLE Users (
    user_id CHAR(60) NOT NULL,
    phone VARCHAR(15) NOT NULL,
    user_first VARCHAR(100) NOT NULL,
    user_last VARCHAR(100) NOT NULL,
    user_birth_date DATE NULL,
    user_gender VARCHAR(10) NOT NULL,
    user_country VARCHAR(20),
    user_password VARCHAR(255) NOT NULL,
    user_status ENUM('active', 'pending', 'blocked') NOT NULL DEFAULT 'pending',
    user_img VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id),
    UNIQUE (phone),
    INDEX (user_last, user_first),
    INDEX (user_country),
    INDEX (user_status)
);

-- 4. Profiles
CREATE TABLE Profiles (
    profile_id CHAR(60) NOT NULL,
    user_id CHAR(60) NOT NULL,
    work_type VARCHAR(20) NOT NULL,
    skill TEXT NOT NULL,
    website TEXT,
    portfolio_path VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (profile_id),
    FOREIGN KEY (user_id) REFERENCES Users(user_id) ON DELETE CASCADE
);

-- 5. Passports
CREATE TABLE Passports (
    passport_id CHAR(60) NOT NULL,
    profile_id CHAR(60) NOT NULL,
    passport_format VARCHAR(10),
    passport_number VARCHAR(20),
    passport_first_name VARCHAR(100),
    passport_last_name VARCHAR(100),
    passport_gender VARCHAR(10),
    passport_country_code VARCHAR(10),
    passport_birth_date DATE,
    passport_expiration_date DATE,
    mrz TEXT,
    passport_img VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (passport_id),
    FOREIGN KEY (profile_id) REFERENCES Profiles(profile_id) ON DELETE CASCADE,
    INDEX (passport_number),
    INDEX (passport_last_name, passport_first_name),
    INDEX (passport_country_code)
);

-- 6. Personal Cards
CREATE TABLE Personal_cards (
    card_id CHAR(60) NOT NULL,
    profile_id CHAR(60) NOT NULL,
    card_number VARCHAR(50) NOT NULL,
    card_first_name VARCHAR(100) NOT NULL,
    card_last_name VARCHAR(100) NOT NULL,
    card_address TEXT,
    card_nationality VARCHAR(15),
    card_religion VARCHAR(15),
    card_birth_date DATE,
    card_issue_date DATE,
    card_expiration_date DATE,
    card_front_img VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (card_id),
    FOREIGN KEY (profile_id) REFERENCES Profiles(profile_id) ON DELETE CASCADE
);

-- 7. Bank Info
CREATE TABLE Bank_info (
    bank_id CHAR(60) NOT NULL,
    profile_id CHAR(60) NOT NULL,
    bank_name VARCHAR(50) NOT NULL,
    bank_account VARCHAR(23) NOT NULL,
    bank_img VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (bank_id),
    FOREIGN KEY (profile_id) REFERENCES Profiles(profile_id) ON DELETE CASCADE
);
