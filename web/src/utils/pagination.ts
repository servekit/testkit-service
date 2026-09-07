/**
 * The console-wide pagination preset for offset-paginated tables.
 * Every numbered list uses this so controls stay identical: page-size
 * changer, quick jumper (type any page number — that is the antd-standard
 * way to reach the first/last page), and the same total caption.
 */
export const listPagination = {
  defaultPageSize: 20,
  showSizeChanger: true,
  pageSizeOptions: [10, 20, 50, 100],
  showQuickJumper: true,
  showTotal: (total: number, range: [number, number]) =>
    `第 ${range[0]}-${range[1]} 条 / 共 ${total} 条`,
};
