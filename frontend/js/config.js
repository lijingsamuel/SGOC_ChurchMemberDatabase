/**
 * config.js
 * Central configuration. Replace SCRIPT_URL with your deployed Apps Script
 * Web App /exec URL after following DEPLOYMENT_GUIDE.md.
 */

export const CONFIG = {
  // e.g. 'https://script.google.com/macros/s/AKfycb.../exec'
  SCRIPT_URL: 'https://script.google.com/macros/s/AKfycbyLTCnHHXNBvM6RQRsf0ryt49uKLGP21pMa7-p8Owq2LQ6YGiL25T0uKxzswurV_pkKxA/exec',
  APP_NAME: 'Church Family Data Collection',
  AUTOSAVE_INTERVAL_MS: 20000
};

export const GENDERS = ['Male', 'Female'];

export const RELATIONS = [
  'Head', 'Spouse', 'Son', 'Daughter', 'Son-in-Law', 'Daughter-in-Law', 'Father', 'Mother',
  'Brother', 'Sister', 'Grandfather', 'Grandmother', 'Grandson', 'Granddaughter', 'Other'
];

export const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-', 'Unknown'];

export const MARITAL_STATUSES = ['Single', 'Married', 'Widowed', 'Divorced'];

export const PRAYER_GROUPS = ['St. Thomas', 'St. George', 'St. Gregorios', "St. Mary's", 'Not Joined'];

export const STATUS_OPTIONS = ['Draft', 'Pending', 'Completed'];
