// Test script to verify authentication and sync functionality
import { supabaseService } from './services/supabase';
import { db } from './services/db';

async function testAuthentication() {
  console.log('Testing Supabase authentication...');
  
  try {
    // Check current session
    const { data: { session }, error } = await supabaseService.getSupabaseClient().auth.getSession();
    
    if (error) {
      console.error('Error getting session:', error);
      return false;
    }
    
    if (session) {
      console.log('✓ User is authenticated');
      console.log('Session expires at:', session.expires_at);
      return true;
    } else {
      console.log('✗ No active session - user needs to log in');
      return false;
    }
  } catch (error) {
    console.error('Error checking authentication:', error);
    return false;
  }
}

async function testSyncCapabilities() {
  console.log('\nTesting sync capabilities...');
  
  try {
    // Check if we can connect to Supabase
    const { data, error } = await supabaseService.getSupabaseClient()
      .from('settings')
      .select('*')
      .limit(1);
    
    if (error) {
      console.error('Error querying Supabase:', error);
      return false;
    }
    
    console.log('✓ Successfully connected to Supabase and queried settings table');
    console.log('Settings retrieved:', data.length);
    return true;
  } catch (error) {
    console.error('Error testing sync capabilities:', error);
    return false;
  }
}

async function runTests() {
  console.log('Running authentication and sync tests...\n');
  
  const authOk = await testAuthentication();
  const syncOk = await testSyncCapabilities();
  
  console.log('\nTest Results:');
  console.log(`Authentication: ${authOk ? 'PASS' : 'FAIL'}`);
  console.log(`Sync Capabilities: ${syncOk ? 'PASS' : 'FAIL'}`);
  
  if (authOk && syncOk) {
    console.log('\n✓ All tests passed! The sync functionality should work properly.');
  } else {
    console.log('\n✗ Some tests failed. Please check the errors above and consult SUPABASE_RLS_SETUP.md for RLS configuration.');
  }
}

// Run the tests
runTests().catch(console.error);