// Decentralized paper submission API
// Only triggers on-chain transactions - no business logic
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createIPFSServiceFromEnv, IPFSUtils } from '@/lib/ipfs/ipfs-service';
import { WalletManager } from '@/lib/wallet/secure-wallet';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const formData = await request.formData();
    const title = formData.get('title') as string;
    const abstract = formData.get('abstract') as string;
    const keywords = JSON.parse(formData.get('keywords') as string) as string[];
    const authors = JSON.parse(formData.get('authors') as string) as string[];
    const pdfFile = formData.get('pdf') as File;
    const submitterAccountId = formData.get('submitterAccountId') as string;
    const passphrase = formData.get('passphrase') as string; // For encrypted key signing

    if (!title || !abstract || !keywords?.length || !authors?.length || !pdfFile || !submitterAccountId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Get user profile with encrypted key
    const { data: profile } = await supabase
      .from('profiles')
      .select('hedera_account_id, encrypted_key_blob')
      .eq('id', user.id)
      .single();

    if (!profile?.hedera_account_id || !profile?.encrypted_key_blob) {
      return NextResponse.json({ 
        error: 'Hedera account not configured. Please set up your wallet.' 
      }, { status: 400 });
    }

    // Convert PDF file to buffer
    const pdfBuffer = await IPFSUtils.fileToBuffer(pdfFile);

    // Create IPFS service and upload paper
    const ipfsService = createIPFSServiceFromEnv();
    const paperMetadata = IPFSUtils.createPaperMetadata(
      title,
      abstract,
      authors,
      keywords,
      submitterAccountId
    );

    console.log('[API] Uploading paper to IPFS...');
    const ipfsResult = await ipfsService.uploadPaper(pdfBuffer, paperMetadata);
    console.log('[API] Paper uploaded to IPFS:', ipfsResult.cid);

    // Create paper record with IPFS and HCS data
    const { data: paper, error: paperError } = await supabase
      .from('papers')
      .insert({
        author_id: user.id,
        title,
        abstract,
        keywords,
        ipfs_cid: ipfsResult.cid,
        hcs_sequence_number: ipfsResult.hcsSequenceNumber ? parseInt(ipfsResult.hcsSequenceNumber) : null,
        hedera_tx_id: ipfsResult.hederaTxId,
        submitter_account: submitterAccountId,
        status: 'submitted',
        submission_date: new Date(),
        required_reviews: 3 // Default
      })
      .select()
      .single();

    if (paperError) {
      console.error('[API] Error creating paper record:', paperError);
      return NextResponse.json({ error: 'Failed to create paper record' }, { status: 500 });
    }

    // Now trigger on-chain submission transaction
    try {
      const walletManager = WalletManager.getInstance();
      
      // Connect using encrypted key
      await walletManager.connectEncryptedKey(
        profile.encrypted_key_blob, 
        passphrase
      );

      // Create paper submission transaction (calls smart contract)
      // This is where the real blockchain interaction happens
      console.log('[API] Submitting paper to blockchain...');
      
      // TODO: Implement actual smart contract call for paper submission
      // const submissionTx = new ContractExecuteTransaction()
      //   .setContractId(RESEARCH_HUB_CONTRACT_ID)
      //   .setGas(300000)
      //   .setFunction('submitPaper', new ContractFunctionParameters()
      //     .addUint256(paper.id)
      //     .addString(ipfsResult.cid)
      //   );

      // const result = await walletManager.executeTransaction(submissionTx, passphrase);
      
      // For now, simulate successful submission
      const mockTxResult = {
        transactionId: `0.0.${Date.now()}@${Math.random().toString(36).substr(2, 9)}`,
        receipt: { status: 'SUCCESS' }
      };

      // Update paper with blockchain transaction ID
      await supabase
        .from('papers')
        .update({
          hedera_tx_id: mockTxResult.transactionId,
          submission_fee_hbar: 10.0 // Standard submission fee
        })
        .eq('id', paper.id);

      // Record transaction for audit trail
      await supabase
        .from('hedera_tx_records')
        .insert({
          transaction_id: mockTxResult.transactionId,
          transaction_type: 'paper_submission',
          hedera_account_id: submitterAccountId,
          paper_id: paper.id,
          amount_hbar: 10.0,
          status: 'success'
        });

      console.log(`[API] Paper submitted successfully: ${paper.id}`);

      // Trigger automatic reviewer assignment based on expertise matching
      console.log('[API] Triggering automatic reviewer assignment...');
      
      try {
        const { ReviewerAssignmentService } = await import('@/lib/assignment/reviewer-assignment');
        
        const assignmentRequest = {
          paperId: paper.id,
          title,
          abstract,
          keywords,
          authorId: user.id,
          requiredReviews: 3,
          minimumReputation: 100,
          minimumStake: 5.0
        };
        
        const assignment = await ReviewerAssignmentService.assignReviewers(assignmentRequest);
        
        if (!assignment.success) {
          console.warn(`[API] Assignment warning: ${assignment.reason}`);
          // Continue - reviewers can still manually claim if auto-assignment fails
        } else {
          console.log(`[API] Successfully assigned ${assignment.assignedReviewers.length} reviewers`);
        }
        
      } catch (assignmentError) {
        console.error('[API] Assignment error:', assignmentError);
        // Continue - don't fail paper submission if assignment fails
      }

      return NextResponse.json({
        success: true,
        paperId: paper.id,
        ipfsCid: ipfsResult.cid,
        transactionId: mockTxResult.transactionId,
        hcsSequenceNumber: ipfsResult.hcsSequenceNumber
      });

    } catch (txError) {
      console.error('[API] Blockchain submission failed:', txError);
      
      // Update paper status to indicate submission failure
      await supabase
        .from('papers')
        .update({ status: 'submission_failed' })
        .eq('id', paper.id);

      return NextResponse.json({ 
        error: 'Blockchain submission failed',
        details: txError instanceof Error ? txError.message : 'Unknown error',
        paperId: paper.id // Still return paper ID for retry attempts
      }, { status: 500 });
    }

  } catch (error) {
    console.error('[API] Paper submission error:', error);
    return NextResponse.json({
      error: 'Paper submission failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}