import { db } from '../services/db';
import { supabaseService } from '../services/supabase';
import { supabaseSyncService } from '../services/supabase-sync-service';

export async function diagnoseSyncIssues() {
  console.log('=== SYNC DIAGNOSTICS ===');
  
  try {
    // Check authentication status
    const { data: { session }, error: authError } = await supabaseService.getCurrentUser();
    if (authError) {
      console.error('Authentication Error:', authError);
    }
    
    if (session) {
      console.log('✓ User is authenticated');
      console.log('Session expires at:', session.expires_at);
    } else {
      console.log('✗ User is NOT authenticated - this would prevent sync');
    }
    
    // Check pending items
    const allAdjustments = db.getStockAdjustments();
    const pendingAdjustments = allAdjustments.filter(adj => adj.sync_status === 'pending');
    
    console.log(`Total stock adjustments: ${allAdjustments.length}`);
    console.log(`Pending stock adjustments: ${pendingAdjustments.length}`);
    
    if (pendingAdjustments.length > 0) {
      console.log('Sample of pending adjustments:');
      pendingAdjustments.slice(0, 5).forEach(adj => {
        console.log(`  - ID: ${adj.adjustment_id}, Type: ${adj.adjustment_type}, Qty: ${adj.quantity}, Item: ${adj.item_id}`);
      });
    }
    
    // Check sync queue
    const queueLength = supabaseSyncService.getQueueLength();
    console.log(`Supabase sync queue length: ${queueLength}`);
    
    // Check if there are any sync errors in recent logs
    console.log('Sync diagnostics completed. Check above for authentication status and pending items.');
    
  } catch (error) {
    console.error('Error during sync diagnostics:', error);
  }
  
  console.log('========================');
}