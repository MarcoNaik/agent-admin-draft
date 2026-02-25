const BASE_URL = "https://api.airtable.com/v0"

function headers(token: string): Record<string, string> {
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  }
}

async function handleResponse(response: Response, operation: string) {
  if (!response.ok) {
    const text = await response.text()
    throw new Error(`Airtable ${operation} failed (${response.status}): ${text}`)
  }
  return response.json()
}

export async function listBases(token: string) {
  const response = await fetch(`${BASE_URL}/meta/bases`, {
    headers: headers(token),
  })
  return handleResponse(response, "listBases")
}

export async function listTables(token: string, baseId: string) {
  const response = await fetch(`${BASE_URL}/meta/bases/${baseId}/tables`, {
    headers: headers(token),
  })
  return handleResponse(response, "listTables")
}

export interface ListRecordsOptions {
  pageSize?: number
  offset?: string
  filterByFormula?: string
  sort?: Array<{ field: string; direction?: "asc" | "desc" }>
  fields?: string[]
  view?: string
}

export async function listRecords(
  token: string,
  baseId: string,
  tableIdOrName: string,
  options?: ListRecordsOptions
) {
  const params = new URLSearchParams()
  if (options?.pageSize) params.set("pageSize", String(options.pageSize))
  if (options?.offset) params.set("offset", options.offset)
  if (options?.filterByFormula) params.set("filterByFormula", options.filterByFormula)
  if (options?.view) params.set("view", options.view)
  if (options?.fields) {
    for (const f of options.fields) {
      params.append("fields[]", f)
    }
  }
  if (options?.sort) {
    options.sort.forEach((s, i) => {
      params.set(`sort[${i}][field]`, s.field)
      if (s.direction) params.set(`sort[${i}][direction]`, s.direction)
    })
  }

  const qs = params.toString()
  const url = `${BASE_URL}/${baseId}/${encodeURIComponent(tableIdOrName)}${qs ? `?${qs}` : ""}`
  const response = await fetch(url, { headers: headers(token) })
  return handleResponse(response, "listRecords")
}

export async function getRecord(
  token: string,
  baseId: string,
  tableIdOrName: string,
  recordId: string
) {
  const response = await fetch(
    `${BASE_URL}/${baseId}/${encodeURIComponent(tableIdOrName)}/${recordId}`,
    { headers: headers(token) }
  )
  return handleResponse(response, "getRecord")
}

export async function createRecords(
  token: string,
  baseId: string,
  tableIdOrName: string,
  records: Array<{ fields: Record<string, unknown> }>
) {
  if (records.length > 10) {
    throw new Error("Airtable createRecords: max 10 records per request")
  }
  const response = await fetch(
    `${BASE_URL}/${baseId}/${encodeURIComponent(tableIdOrName)}`,
    {
      method: "POST",
      headers: headers(token),
      body: JSON.stringify({ records }),
    }
  )
  return handleResponse(response, "createRecords")
}

export async function updateRecords(
  token: string,
  baseId: string,
  tableIdOrName: string,
  records: Array<{ id: string; fields: Record<string, unknown> }>
) {
  if (records.length > 10) {
    throw new Error("Airtable updateRecords: max 10 records per request")
  }
  const response = await fetch(
    `${BASE_URL}/${baseId}/${encodeURIComponent(tableIdOrName)}`,
    {
      method: "PATCH",
      headers: headers(token),
      body: JSON.stringify({ records }),
    }
  )
  return handleResponse(response, "updateRecords")
}

export async function deleteRecords(
  token: string,
  baseId: string,
  tableIdOrName: string,
  recordIds: string[]
) {
  if (recordIds.length > 10) {
    throw new Error("Airtable deleteRecords: max 10 records per request")
  }
  const params = new URLSearchParams()
  for (const id of recordIds) {
    params.append("records[]", id)
  }
  const response = await fetch(
    `${BASE_URL}/${baseId}/${encodeURIComponent(tableIdOrName)}?${params}`,
    {
      method: "DELETE",
      headers: headers(token),
    }
  )
  return handleResponse(response, "deleteRecords")
}
