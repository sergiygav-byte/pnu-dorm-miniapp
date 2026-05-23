-- Міграція v11: статистика завантаженості БД для адміна
-- Після v8

-- RPC функція для отримання статистики завантаженості БД
CREATE OR REPLACE FUNCTION get_db_stats()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_stats JSON;
  v_total_records INT;
  v_storage_files INT;
BEGIN
  -- Підрахунок загальної кількості записів у всіх таблицях
  SELECT 
    (SELECT COUNT(*) FROM goals) +
    (SELECT COUNT(*) FROM payments) +
    (SELECT COUNT(*) FROM expenses) +
    (SELECT COUNT(*) FROM events) +
    (SELECT COUNT(*) FROM duty) +
    (SELECT COUNT(*) FROM leaders) +
    (SELECT COUNT(*) FROM complaints) +
    (SELECT COUNT(*) FROM polls) +
    (SELECT COUNT(*) FROM poll_votes) +
    (SELECT COUNT(*) FROM sanitary_comments)
  INTO v_total_records;

  -- Підрахунок файлів у Storage (приблизно, через таблицю storage.objects)
  SELECT COUNT(*) INTO v_storage_files
  FROM storage.objects
  WHERE bucket_id = 'dorm-photos';

  -- Формування JSON з статистикою
  SELECT json_build_object(
    'total_records', v_total_records,
    'storage_files', v_storage_files,
    'db_limit_mb', 500,
    'storage_limit_gb', 1,
    'records_limit', 50000,
    'db_usage_percent', LEAST(ROUND((v_total_records::FLOAT / 50000) * 100, 1), 100),
    'storage_usage_percent', LEAST(ROUND((v_storage_files::FLOAT / 1000) * 100, 1), 100)
  ) INTO v_stats;

  RETURN v_stats;
END;
$$;

GRANT EXECUTE ON FUNCTION get_db_stats() TO anon, authenticated;
