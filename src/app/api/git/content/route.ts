import { NextRequest, NextResponse } from "next/server"
import { readFile, writeFile } from "fs/promises"
import path from "path"

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const repo = searchParams.get("repo") || "/mnt/storage/Documents/Code/antikode/yamaha-golang-api"
  const file = searchParams.get("file") || ""

  if (!file) {
    return NextResponse.json({ error: "No file specified" }, { status: 400 })
  }

  try {
    // Resolve and make sure the file stays inside the repo
    const repoRoot = path.resolve(repo)
    const filePath = path.resolve(repoRoot, file)
    if (!filePath.startsWith(repoRoot + path.sep)) {
      return NextResponse.json({ error: "Invalid file path" }, { status: 400 })
    }

    const content = await readFile(filePath, "utf-8")
    return NextResponse.json({ content })
  } catch (e) {
    return NextResponse.json({
      error: e instanceof Error ? e.message : "Failed to read file",
    }, { status: 500 })
  }
}

export async function PUT(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const repo = searchParams.get("repo") || "/mnt/storage/Documents/Code/antikode/yamaha-golang-api"
  const file = searchParams.get("file") || ""

  if (!file) {
    return NextResponse.json({ error: "No file specified" }, { status: 400 })
  }

  let content: string
  try {
    const body = await req.json()
    content = body.content ?? ""
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  try {
    // Resolve and make sure the file stays inside the repo
    const repoRoot = path.resolve(repo)
    const filePath = path.resolve(repoRoot, file)
    if (!filePath.startsWith(repoRoot + path.sep)) {
      return NextResponse.json({ error: "Invalid file path" }, { status: 400 })
    }

    await writeFile(filePath, content, "utf-8")
    return NextResponse.json({ success: true })
  } catch (e) {
    return NextResponse.json({
      error: e instanceof Error ? e.message : "Failed to write file",
    }, { status: 500 })
  }
}
