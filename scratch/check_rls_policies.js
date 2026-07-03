const { Client } = require('pg');

const host = 'db.wzqaawfqcjxztiyfsmof.supabase.co';
const user = 'postgres';
const password = 'yogesh123*'; // Wait, this password failed earlier!
// Let's check what password is in SUPABASE_SETUP.md or ENV if any.
// Ah, the password in SUPABASE_SETUP.md was 'Choose a strong password (save it!)'.
// The password 'yogesh123*' in check_db.js was probably correct, but wait, did it say password authentication failed?
// Yes. Let's see if we can query using Supabase client instead, or check if we can run a SQL function to list policies.
