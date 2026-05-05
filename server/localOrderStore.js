import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const DEFAULT_ORDER_DIRECTORY = path.resolve(process.cwd(), '.local-data/orders');

function getOrderDirectory() {
  return process.env.LOCAL_ORDER_STORAGE_PATH || DEFAULT_ORDER_DIRECTORY;
}

function getOrderPath(sessionId) {
  return path.join(getOrderDirectory(), `${sessionId}.json`);
}

export async function readLocalOrder(sessionId) {
  try {
    const file = await readFile(getOrderPath(sessionId), 'utf8');
    return JSON.parse(file);
  } catch (error) {
    if (error.code === 'ENOENT') {
      return null;
    }

    throw error;
  }
}

export async function saveLocalOrder(orderRecord) {
  const orderDirectory = getOrderDirectory();
  await mkdir(orderDirectory, { recursive: true });
  await writeFile(getOrderPath(orderRecord.id), JSON.stringify(orderRecord, null, 2));
}

export async function listLocalOrders(limit = 20) {
  const orderDirectory = getOrderDirectory();

  try {
    const files = await readdir(orderDirectory);
    const orderFiles = files.filter((fileName) => fileName.endsWith('.json'));

    const orders = await Promise.all(
      orderFiles.map(async (fileName) => {
        const file = await readFile(path.join(orderDirectory, fileName), 'utf8');
        return JSON.parse(file);
      })
    );

    return orders
      .sort(
        (left, right) => new Date(right.recordedAt || 0).getTime() - new Date(left.recordedAt || 0).getTime()
      )
      .slice(0, limit);
  } catch (error) {
    if (error.code === 'ENOENT') {
      return [];
    }

    throw error;
  }
}