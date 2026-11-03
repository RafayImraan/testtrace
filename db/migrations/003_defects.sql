-- Defects connect a requirement to a test case and preserve the cycle context
-- in which the issue was found.
CREATE TYPE defect_state AS ENUM ('open', 'confirmed', 'fixed', 'closed');
CREATE TYPE defect_severity AS ENUM ('minor', 'major', 'critical', 'blocker');
CREATE UNIQUE INDEX requirements_id_project_uq ON requirements (id, project_id);
CREATE UNIQUE INDEX test_cases_id_project_req_uq ON test_cases (id, project_id, requirement_id);

CREATE TABLE defects (
  id             SERIAL PRIMARY KEY,
  project_id     INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  requirement_id INTEGER NOT NULL REFERENCES requirements(id) ON DELETE CASCADE,
  test_case_id   INTEGER NOT NULL REFERENCES test_cases(id) ON DELETE CASCADE,
  cycle_test_id  INTEGER REFERENCES cycle_tests(id) ON DELETE SET NULL,
  title          VARCHAR(200) NOT NULL,
  description    TEXT NOT NULL,
  severity       defect_severity NOT NULL DEFAULT 'major',
  status         defect_state NOT NULL DEFAULT 'open',
  created_by     INTEGER REFERENCES users(id) ON DELETE SET NULL,
  assigned_to    INTEGER REFERENCES users(id) ON DELETE SET NULL,
  resolved_at    TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT defects_requirement_case_project_fk FOREIGN KEY (requirement_id, project_id)
    REFERENCES requirements(id, project_id) DEFERRABLE INITIALLY IMMEDIATE,
  CONSTRAINT defects_case_requirement_project_fk FOREIGN KEY (test_case_id, project_id, requirement_id)
    REFERENCES test_cases(id, project_id, requirement_id) DEFERRABLE INITIALLY IMMEDIATE
);

CREATE INDEX idx_defects_project_status ON defects (project_id, status, created_at DESC);
CREATE INDEX idx_defects_requirement ON defects (requirement_id, created_at DESC);
CREATE INDEX idx_defects_test_case ON defects (test_case_id, created_at DESC);
CREATE TRIGGER trg_defects_updated BEFORE UPDATE ON defects FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Extend the existing traceability view so requirement -> case -> latest result
-- -> defects is available to reports and other database consumers as well.
CREATE OR REPLACE VIEW v_traceability AS
SELECT req.id AS requirement_id,
       req.project_id,
       req.code AS requirement_code,
       req.title AS requirement_title,
       req.priority AS requirement_priority,
       tc.id AS test_case_id,
       tc.code AS test_case_code,
       tc.title AS test_case_title,
       tc.priority AS test_case_priority,
       tc.is_automated,
       ct.id AS cycle_test_id,
       ct.cycle_id,
       c.name AS cycle_name,
       ct.status,
       ct.due_date,
       ct.remarks,
       u.full_name AS assignee,
       le.execution_type,
       le.created_at AS last_executed_at,
       COALESCE(defect_links.items, '[]'::json) AS defects
FROM requirements req
LEFT JOIN test_cases tc ON tc.requirement_id = req.id
LEFT JOIN LATERAL (
  SELECT ct0.* FROM cycle_tests ct0
  WHERE ct0.test_case_id = tc.id
  ORDER BY ct0.updated_at DESC, ct0.id DESC LIMIT 1
) ct ON TRUE
LEFT JOIN test_cycles c ON c.id = ct.cycle_id
LEFT JOIN users u ON u.id = ct.assignee_id
LEFT JOIN v_latest_execution le ON le.cycle_test_id = ct.id
LEFT JOIN LATERAL (
  SELECT json_agg(json_build_object(
    'id', d.id,
    'code', 'DEF-' || lpad(d.id::text, 3, '0'),
    'title', d.title,
    'status', d.status,
    'severity', d.severity
  ) ORDER BY d.id) AS items
  FROM defects d
  WHERE d.requirement_id = req.id AND d.test_case_id = tc.id
) defect_links ON TRUE;
