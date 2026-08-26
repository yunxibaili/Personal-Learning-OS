-- 003_concept_status: 实体生命周期（ADR-008/009 修订——评审条件 3）
-- stub(unconfirmed) → confirmed → active；archived 为软删除态。
-- origin 记录来源(manual|markdown|ai_suggested)，status 记录生命周期，二者分离。
ALTER TABLE concepts ADD COLUMN status TEXT NOT NULL DEFAULT 'active';
