-- Add some test submissions for reviewer testing
-- This script creates sample papers that reviewers can practice with

INSERT INTO public.submissions (
  submitter_id, 
  title, 
  abstract, 
  keywords, 
  pdf_url, 
  status
) VALUES 
-- Test submission 1
(
  (SELECT id FROM public.profiles WHERE role = 'submitter' LIMIT 1),
  'Blockchain Applications in Academic Publishing',
  'This paper explores the use of blockchain technology for creating transparent and decentralized academic publishing systems. We examine consensus mechanisms, token economics, and peer review incentives.',
  ARRAY['blockchain', 'academic publishing', 'decentralization', 'peer review'],
  'https://example.com/sample-paper-1.pdf',
  'submitted'
),
-- Test submission 2  
(
  (SELECT id FROM public.profiles WHERE role = 'submitter' LIMIT 1),
  'Decentralized Peer Review Using Smart Contracts',
  'We present a novel approach to peer review that leverages smart contracts for transparent reviewer assignment, stake-based quality assurance, and automated reward distribution.',
  ARRAY['smart contracts', 'peer review', 'reputation systems', 'ethereum'],
  'https://example.com/sample-paper-2.pdf', 
  'under-review'
),
-- Test submission 3
(
  (SELECT id FROM public.profiles WHERE role = 'submitter' LIMIT 1),
  'IPFS for Academic Paper Storage and Versioning',
  'This study investigates the use of IPFS (InterPlanetary File System) for immutable storage of academic papers, version control, and content addressing in decentralized research networks.',
  ARRAY['IPFS', 'distributed storage', 'version control', 'content addressing'],
  'https://example.com/sample-paper-3.pdf',
  'submitted'
);

-- Update one submission to have a different submitter if there are multiple submitters
UPDATE public.submissions 
SET submitter_id = (
  SELECT id FROM public.profiles 
  WHERE role = 'submitter' 
  AND id != (SELECT submitter_id FROM public.submissions LIMIT 1)
  LIMIT 1
)
WHERE title = 'IPFS for Academic Paper Storage and Versioning';

-- Show the created test submissions
SELECT 
  s.title,
  s.status,
  s.keywords,
  p.full_name as submitter_name
FROM public.submissions s
JOIN public.profiles p ON s.submitter_id = p.id
ORDER BY s.created_at DESC;