/**
 * Export an HTML table element to a CSV/Excel file.
 */
export function exportTableToCSV(selector: string, filename: string) {
  const table = document.querySelector(selector);
  if (!table) return;

  const csv: string[] = [];
  const rows = table.querySelectorAll("tr");

  for (let i = 0; i < rows.length; i++) {
    const row: string[] = [];
    const cols = rows[i].querySelectorAll("td, th");

    for (let j = 0; j < cols.length; j++) {
      const htmlElement = cols[j] as HTMLElement;
      // Skip cells that contain buttons (like edit/delete actions)
      if (htmlElement.querySelector("button") && !htmlElement.querySelector("select")) {
        row.push('""');
      } else {
        const select = htmlElement.querySelector("select");
        const text = select ? select.value : htmlElement.innerText;
        const cleaned = text.trim().replace(/"/g, '""');
        row.push(`"${cleaned}"`);
      }
    }
    csv.push(row.join(","));
  }

  const csvString = csv.join("\n");
  const blob = new Blob([csvString], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/**
 * Trigger native print dialog for PDF generation
 */
export function exportToPDF() {
  window.print();
}
