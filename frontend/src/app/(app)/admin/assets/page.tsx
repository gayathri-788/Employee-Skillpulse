'use client';

import { useMemo, useState, type FormEvent } from 'react';
import { Modal } from '@/components/modal';
import { Spinner } from '@/components/spinner';
import { useAuth } from '@/lib/auth-context';
import { useToast } from '@/lib/toast-context';
import { useApiData } from '@/lib/use-api-data';
import {
  adminTable,
  badgeSuccess,
  btnIconOnly,
  btnPrimary,
  btnSecondary,
  cx,
  formGroup,
  inputDisabled,
  lastUpdatedBadge,
  pageHeaderRow,
  pageHeaderSubtitle,
  pageHeaderTitle,
  panel,
  searchBtnGroup,
  searchPanel,
} from '@/lib/ui';
import type { Employee } from '@/lib/types';

interface EditState {
  employeeId: string;
  name: string;
  hasLaptop: string;
  laptopDetails: string;
  hasHeadset: string;
}

export default function OfficeAssetsPage() {
  const { authedFetch } = useAuth();
  const { showToast } = useToast();
  const { data: employees, loading, refetch } = useApiData<Employee[]>('/api/employees');

  const [search, setSearch] = useState('');
  const [laptopFilter, setLaptopFilter] = useState('');
  const [headsetFilter, setHeadsetFilter] = useState('');
  const [edit, setEdit] = useState<EditState | null>(null);
  const [saving, setSaving] = useState(false);

  const filtered = useMemo(() => {
    const searchVal = search.toLowerCase().trim();
    return (employees || []).filter((emp) => {
      const matchesSearch = !searchVal || emp.name.toLowerCase().includes(searchVal) || emp.employee_id.toLowerCase().includes(searchVal);
      const matchesLaptop = !laptopFilter || emp.has_laptop === laptopFilter;
      const matchesHeadset = !headsetFilter || emp.has_headset === headsetFilter;
      return matchesSearch && matchesLaptop && matchesHeadset;
    });
  }, [employees, search, laptopFilter, headsetFilter]);

  function handleClear() {
    setSearch('');
    setLaptopFilter('');
    setHeadsetFilter('');
  }

  function openEdit(emp: Employee) {
    setEdit({
      employeeId: emp.employee_id,
      name: emp.name,
      hasLaptop: emp.has_laptop || 'No',
      laptopDetails: emp.laptop_details || '',
      hasHeadset: emp.has_headset || 'No',
    });
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!edit) return;
    setSaving(true);
    try {
      await authedFetch(`/api/employees/${edit.employeeId}/assets`, {
        method: 'PUT',
        body: JSON.stringify({
          has_laptop: edit.hasLaptop,
          laptop_details: edit.hasLaptop === 'Yes' ? edit.laptopDetails : null,
          has_headset: edit.hasHeadset,
          headset_details: null,
        }),
      });
      showToast('Assets updated successfully!', 'success');
      setEdit(null);
      refetch();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Error updating assets', 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <div className={pageHeaderRow}>
        <div>
          <h1 className={pageHeaderTitle}>Office Assets Tracking</h1>
          <p className={pageHeaderSubtitle}>View and manage office laptops and headsets allocation for all employees.</p>
        </div>
        <div className={lastUpdatedBadge}>
          <span>Total Employees: </span>
          <strong>{loading ? '—' : filtered.length}</strong>
        </div>
      </div>

      <div className={cx(searchPanel, '!mb-6')}>
        <div className="grid grid-cols-[1fr_180px_180px_120px] gap-5 items-end max-[992px]:grid-cols-2 max-[576px]:grid-cols-1">
          <div className={cx(formGroup, '!mb-0')}>
            <label htmlFor="assets-search-name">Search Employee Name / ID</label>
            <div className="relative">
              <span className="material-icons-round absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted text-xl">search</span>
              <input
                type="text"
                id="assets-search-name"
                placeholder="Name or Emp ID…"
                className="pl-11"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>
          <div className={cx(formGroup, '!mb-0')}>
            <label htmlFor="assets-filter-laptop">Laptop Status</label>
            <select id="assets-filter-laptop" value={laptopFilter} onChange={(e) => setLaptopFilter(e.target.value)}>
              <option value="">All Laptops</option>
              <option value="Yes">Yes (Taken)</option>
              <option value="No">No (Not Taken)</option>
            </select>
          </div>
          <div className={cx(formGroup, '!mb-0')}>
            <label htmlFor="assets-filter-headset">Headset Status</label>
            <select id="assets-filter-headset" value={headsetFilter} onChange={(e) => setHeadsetFilter(e.target.value)}>
              <option value="">All Headsets</option>
              <option value="Yes">Yes (Taken)</option>
              <option value="No">No (Not Taken)</option>
            </select>
          </div>
          <div className={cx(formGroup, '!mb-0', searchBtnGroup, 'self-end')}>
            <button className={cx(btnSecondary, 'w-full')} onClick={handleClear}>
              Clear
            </button>
          </div>
        </div>
      </div>

      <div className={panel}>
        <div className="overflow-x-auto w-full">
          <table className={adminTable}>
            <thead>
              <tr>
                <th>Emp ID</th>
                <th>Employee Name</th>
                <th>Laptop</th>
                <th>Headset</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={5} className="text-center py-10">
                    <div className="flex flex-col items-center gap-3">
                      <Spinner />
                      Loading asset details...
                    </div>
                  </td>
                </tr>
              )}
              {!loading && filtered.length === 0 && (
                <tr>
                  <td colSpan={5} className="text-center py-10 text-text-muted">
                    No employees found matching the filters.
                  </td>
                </tr>
              )}
              {!loading &&
                filtered.map((emp) => (
                  <tr key={emp.employee_id}>
                    <td>
                      <strong>{emp.employee_id}</strong>
                    </td>
                    <td>{emp.name}</td>
                    <td>
                      {emp.has_laptop === 'Yes' ? (
                        <span className={cx(badgeSuccess, '!inline-flex !items-center !gap-1 !px-2 !py-1')}>
                          <span className="material-icons-round text-sm">laptop</span> {emp.laptop_details || 'Yes'}
                        </span>
                      ) : (
                        <span className="text-text-muted font-bold">—</span>
                      )}
                    </td>
                    <td>
                      {emp.has_headset === 'Yes' ? (
                        <span className={cx(badgeSuccess, '!inline-flex !items-center !gap-1 !px-2 !py-1')}>
                          <span className="material-icons-round text-sm">headphones</span> Yes
                        </span>
                      ) : (
                        <span className="text-text-muted font-bold">—</span>
                      )}
                    </td>
                    <td>
                      <button className={cx(btnSecondary, btnIconOnly)} title="Edit Assets" onClick={() => openEdit(emp)}>
                        <span className="material-icons-round">edit</span>
                      </button>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>

      <Modal open={!!edit} onClose={() => setEdit(null)} title="Edit Office Assets" size="sm">
        {edit && (
          <form onSubmit={handleSubmit}>
            <div className={formGroup}>
              <label htmlFor="assets-edit-emp-name">Employee Name</label>
              <input type="text" id="assets-edit-emp-name" readOnly disabled className={inputDisabled} value={edit.name} />
            </div>
            <div className={formGroup}>
              <label htmlFor="assets-edit-laptop">Taken Office Laptop?</label>
              <select
                id="assets-edit-laptop"
                required
                value={edit.hasLaptop}
                onChange={(e) => setEdit((prev) => (prev ? { ...prev, hasLaptop: e.target.value } : prev))}
              >
                <option value="Yes">Yes</option>
                <option value="No">No</option>
              </select>
            </div>
            {edit.hasLaptop === 'Yes' && (
              <div className={formGroup}>
                <label htmlFor="assets-edit-laptop-details">Laptop Name &amp; Details</label>
                <input
                  type="text"
                  id="assets-edit-laptop-details"
                  placeholder="e.g. Dell Latitude 5420"
                  value={edit.laptopDetails}
                  onChange={(e) => setEdit((prev) => (prev ? { ...prev, laptopDetails: e.target.value } : prev))}
                />
              </div>
            )}
            <div className={formGroup}>
              <label htmlFor="assets-edit-headset">Taken Headset from Office?</label>
              <select
                id="assets-edit-headset"
                required
                value={edit.hasHeadset}
                onChange={(e) => setEdit((prev) => (prev ? { ...prev, hasHeadset: e.target.value } : prev))}
              >
                <option value="Yes">Yes</option>
                <option value="No">No</option>
              </select>
            </div>
            <div className="flex gap-3 justify-end mt-4">
              <button type="button" className={btnSecondary} onClick={() => setEdit(null)}>
                Cancel
              </button>
              <button type="submit" className={btnPrimary} disabled={saving}>
                <span className="material-icons-round">save</span>
                <span>{saving ? 'Saving…' : 'Save Asset Details'}</span>
              </button>
            </div>
          </form>
        )}
      </Modal>
    </>
  );
}
