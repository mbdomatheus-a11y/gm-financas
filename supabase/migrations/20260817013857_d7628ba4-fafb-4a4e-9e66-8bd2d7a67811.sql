CREATE POLICY faturas_select ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'faturas' AND private.is_active_member());
CREATE POLICY faturas_insert ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'faturas' AND private.is_active_member());
CREATE POLICY faturas_update ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'faturas' AND private.is_active_member())
  WITH CHECK (bucket_id = 'faturas' AND private.is_active_member());
CREATE POLICY faturas_delete ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'faturas' AND private.is_active_member());