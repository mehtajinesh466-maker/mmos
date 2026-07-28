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
        let text = "";
        
        if (select) {
          text = select.value;
        } else {
          // Clone the cell to clean up decorative/visual elements without modifying the active UI
          const clone = htmlElement.cloneNode(true) as HTMLElement;
          
          // Remove decorative elements
          clone.querySelectorAll("img").forEach(img => img.remove());
          clone.querySelectorAll("div, span").forEach(el => {
            const classList = el.className || "";
            if (
              classList.includes("rounded-full") ||
              classList.includes("w-6") ||
              classList.includes("h-6") ||
              classList.includes("w-8") ||
              classList.includes("h-8")
            ) {
              el.remove();
            }
          });

          text = clone.innerText || clone.textContent || "";
        }
        
        // Clean text formatting
        text = text.replace(/\r?\n|\r/g, " ").replace(/\s+/g, " ");
        // Strip sorting symbols/arrows from the end of headers
        text = text.replace(/\s*[↑↓]\s*$/, "").trim();
        
        const cleaned = text.replace(/"/g, '""');
        row.push(`"${cleaned}"`);
      }
    }
    csv.push(row.join(","));
  }

  const csvString = csv.join("\n");
  // Prepend UTF-8 BOM (\ufeff) for compatibility with Excel
  const blob = new Blob(["\ufeff" + csvString], { type: "text/csv;charset=utf-8;" });
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
