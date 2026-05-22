INSERT INTO files (id, filename, r2_key, uploader, downloads)
VALUES
  ('seed-file-1', 'hello.txt', 'seed/hello.txt', 'seed-user', 3),
  ('seed-file-2', 'demo.pdf', 'seed/demo.pdf', 'seed-user', 1)
ON CONFLICT(id) DO NOTHING;
