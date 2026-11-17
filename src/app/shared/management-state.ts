export class ManagementState<T> {
  query = '';
  filter = '';
  secondaryFilter = '';
  page = 1;
  readonly pageSize = 5;
  selected: T | null = null;
  editing: T | null = null;
  pending: T | null = null;
  notice = '';
  paginate(rows: T[]): T[] {
    return rows.slice((this.page - 1) * this.pageSize, this.page * this.pageSize);
  }
  pages(rows: T[]): number {
    return Math.max(1, Math.ceil(rows.length / this.pageSize));
  }
  resetPage(): void {
    this.page = 1;
  }
  close(): void {
    this.selected = null;
    this.editing = null;
    this.pending = null;
  }
}
