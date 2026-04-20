SELECT 
  p.email,
  p.first_name,
  p.last_name,
  u.password,
  CASE
    WHEN a.id IS NOT NULL THEN 'ADMIN'
    WHEN w.id IS NOT NULL THEN 'WORKER'
    ELSE 'CLIENT'
  END AS rol,
  u.state,
  u.created_at
FROM auth.people p
JOIN auth.user u ON u.people_id = p.id
LEFT JOIN auth.worker w ON w.people_id = p.id
LEFT JOIN auth.admin a ON a.people_id = p.id;

