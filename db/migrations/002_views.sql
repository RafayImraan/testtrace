-- =====================================================================
--  Migration 002: reporting views
--  Views keep the dashboard / traceability / test case list SQL simple
--  and are a nice thing to show during the viva.
-- =====================================================================

-- Latest execution (manual or automated) per test case, per cycle.
CREATE OR REPLACE VIEW v_latest_execution AS
SELECT DISTINCT ON (e.cycle_test_id)
       e.id                AS execution_id,
       e.cycle_test_id,
       e.test_case_id,
       e.cycle_id,
       e.status,
       e.execution_type,
       e.actual_result,
       e.remarks,
       e.screenshot_path,
       e.duration_ms,
       e.executed_by,
       e.created_at
FROM executions e
ORDER BY e.cycle_test_id, e.created_at DESC, e.id DESC;

-- Test case list with its most recent status across all cycles
-- (used for the "status" filter on the Test Cases page).
CREATE OR REPLACE VIEW v_test_case_status AS
SELECT tc.id                     AS test_case_id,
       tc.project_id,
       tc.code,
       tc.title,
       tc.module,
       tc.priority,
       tc.is_automated,
       tc.requirement_id,
       r.code                    AS requirement_code,
       sub.status                AS latest_status,
       sub.cycle_id              AS latest_cycle_id,
       sub.assignee_id           AS latest_assignee_id,
       sub.due_date              AS latest_due_date,
       sub.updated_at            AS last_status_at
FROM test_cases tc
LEFT JOIN requirements r ON r.id = tc.requirement_id
LEFT JOIN LATERAL (
  SELECT ct.status, ct.cycle_id, ct.assignee_id, ct.due_date, ct.updated_at
  FROM cycle_tests ct
  WHERE ct.test_case_id = tc.id
  ORDER BY ct.updated_at DESC
  LIMIT 1
) sub ON TRUE;

-- Requirement -> test case -> latest result (traceability matrix + coverage)
CREATE OR REPLACE VIEW v_traceability AS
SELECT req.id                        AS requirement_id,
       req.project_id,
       req.code                      AS requirement_code,
       req.title                     AS requirement_title,
       req.priority                  AS requirement_priority,
       tc.id                         AS test_case_id,
       tc.code                       AS test_case_code,
       tc.title                      AS test_case_title,
       tc.priority                   AS test_case_priority,
       tc.is_automated,
       ct.id                         AS cycle_test_id,
       ct.cycle_id,
       c.name                        AS cycle_name,
       ct.status,
       ct.due_date,
       ct.remarks,
       u.full_name                   AS assignee,
       le.execution_type,
       le.created_at                 AS last_executed_at
FROM requirements req
LEFT JOIN test_cases tc  ON tc.requirement_id = req.id
LEFT JOIN cycle_tests ct ON ct.test_case_id = tc.id
LEFT JOIN test_cycles c  ON c.id = ct.cycle_id
LEFT JOIN users u        ON u.id = ct.assignee_id
LEFT JOIN v_latest_execution le ON le.cycle_test_id = ct.id;
