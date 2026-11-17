-- Widen finance_documents to also archive Deals & Marketing documents (Property & Deal
-- Proposals, Unit Handover & Inspection Forms, Marketing Approvals). These share the same
-- archive/table as finance documents (one unified Documents view) but have no amount/VAT,
-- and are gated by the coarser `modules.deals` flag rather than the per-type `finance_docs`
-- toggles used for real financial documents.

-- 1. Widen the doc_type check constraint.
alter table public.finance_documents drop constraint if exists finance_documents_doc_type_check;
alter table public.finance_documents add constraint finance_documents_doc_type_check
  check (doc_type in (
    'tax_invoice', 'receipt', 'rental_contract', 'payment_voucher', 'other',
    'deal_proposal', 'unit_handover', 'marketing_approval'
  ));

-- 2. Replace the finance_documents RLS policies with a branch for deals-gated doc types.
drop policy if exists finance_documents_select on public.finance_documents;
drop policy if exists finance_documents_insert on public.finance_documents;
drop policy if exists finance_documents_update on public.finance_documents;
drop policy if exists finance_documents_delete on public.finance_documents;

create policy finance_documents_select on public.finance_documents for select to authenticated
  using (
    (doc_type in ('deal_proposal', 'unit_handover', 'marketing_approval')
      and public.has_module('deals')
      and (public.scope_all() or created_by = auth.uid()))
    or (doc_type not in ('deal_proposal', 'unit_handover', 'marketing_approval')
      and public.has_module('finance')
      and public.has_doc(doc_type)
      and (public.scope_all() or created_by = auth.uid()))
  );

create policy finance_documents_insert on public.finance_documents for insert to authenticated
  with check (
    (doc_type in ('deal_proposal', 'unit_handover', 'marketing_approval')
      and public.has_module('deals')
      and created_by = auth.uid())
    or (doc_type not in ('deal_proposal', 'unit_handover', 'marketing_approval')
      and public.has_module('finance')
      and public.can_create_finance()
      and public.has_doc(doc_type)
      and created_by = auth.uid())
  );

create policy finance_documents_update on public.finance_documents for update to authenticated
  using (
    (doc_type in ('deal_proposal', 'unit_handover', 'marketing_approval')
      and public.has_module('deals')
      and (public.scope_all() or created_by = auth.uid()))
    or (doc_type not in ('deal_proposal', 'unit_handover', 'marketing_approval')
      and public.has_module('finance')
      and public.can_create_finance()
      and public.has_doc(doc_type)
      and (public.scope_all() or created_by = auth.uid()))
  )
  with check (
    (doc_type in ('deal_proposal', 'unit_handover', 'marketing_approval')
      and public.has_module('deals'))
    or (doc_type not in ('deal_proposal', 'unit_handover', 'marketing_approval')
      and public.has_module('finance')
      and public.can_create_finance()
      and public.has_doc(doc_type))
  );

create policy finance_documents_delete on public.finance_documents for delete to authenticated
  using (public.current_app_role() = 'admin');
