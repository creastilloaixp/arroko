/**
 * Supabase Helper for Tests
 * Provides utilities to clean up and prepare test data
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY!;

export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

/**
 * Clean up test data (use with caution!)
 */
export async function cleanupTestData() {
  // Delete test participants (those created in the last hour)
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();

  await supabaseAdmin
    .from('spins')
    .delete()
    .gte('created_at', oneHourAgo);

  await supabaseAdmin
    .from('participants')
    .delete()
    .gte('created_at', oneHourAgo);
}

/**
 * Create a test participant
 */
export async function createTestParticipant(email = 'test@example.com') {
  const { data, error } = await supabaseAdmin
    .from('participants')
    .insert({
      full_name: 'Test User',
      email,
      phone: '+525512345678',
      birth_date: '1990-01-01',
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Create a test spin
 */
export async function createTestSpin(participantId: string, prizeId: string) {
  const { data, error } = await supabaseAdmin
    .from('spins')
    .insert({
      participant_id: participantId,
      prize_id: prizeId,
      redeemed: false,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Get unredeemed spin
 */
export async function getUnredeemedSpin() {
  const { data, error } = await supabaseAdmin
    .from('spins')
    .select('*')
    .eq('redeemed', false)
    .limit(1)
    .single();

  if (error && error.code !== 'PGRST116') throw error;
  return data;
}

/**
 * Create admin user for testing
 */
export async function createTestAdminUser(email = 'admin@test.com', password = 'TestPassword123!') {
  // Create auth user
  const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (authError) throw authError;

  // Add to admin_users table
  const { error: adminError } = await supabaseAdmin
    .from('admin_users')
    .insert({
      user_id: authData.user.id,
      role: 'admin',
    });

  if (adminError && adminError.code !== '23505') { // Ignore duplicate key error
    throw adminError;
  }

  return { user: authData.user, email, password };
}

/**
 * Delete test admin user
 */
export async function deleteTestAdminUser(userId: string) {
  await supabaseAdmin
    .from('admin_users')
    .delete()
    .eq('user_id', userId);

  await supabaseAdmin.auth.admin.deleteUser(userId);
}
