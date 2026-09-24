# แผน TanStack Query (Phase 2 — ยังไม่ได้ลงมือทำ)

> เอกสารนี้อธิบาย**แผน**การย้าย data fetching ฝั่ง client จาก `useState`/`useEffect` มือเขียน ไปเป็น [TanStack Query](https://tanstack.com/query) ยังไม่มีโค้ดจริงในโปรเจกต์ ณ ตอนที่เขียนเอกสารนี้ — เป็น Phase 2 ต่อจาก Phase 1 (ย้าย auth token จาก `localStorage` ไปเป็น httpOnly cookie) ซึ่งต้องทดสอบ login/logout ผ่านในเบราว์เซอร์ก่อนถึงจะเริ่ม Phase 2 ได้

## ทำไมต้องย้าย

ตอนนี้ทุก component ที่ต้องคุยกับ API (`App.jsx`, `EquipmentManager.jsx`, `EquipmentDetailPage.jsx`) เขียน pattern นี้ซ้ำด้วยมือ:

```js
const [data, setData] = useState([]);
const [loading, setLoading] = useState(true);
const [error, setError] = useState('');

useEffect(() => {
  async function load() {
    setLoading(true);
    try {
      const result = await getX();
      setData(result.x);
    } catch (err) {
      handleError(err); // เช็ค 401 เอง ทุกจุด
    } finally {
      setLoading(false);
    }
  }
  load();
}, [deps]);

// หลัง mutation ต้อง reload มือเสมอ
async function submit() {
  await updateX(...);
  await load(); // หรือ reloadActiveEquipment() แบบใน EquipmentManager
}
```

TanStack Query ครอบ loading/error state, cache, และ "reload หลัง mutation" ให้อัตโนมัติ (`invalidateQueries`) เหลือแค่ state ที่เป็น UI ล้วนๆ (เช่น `formMode`, `editingEquipment`)

## ติดตั้ง

```powershell
npm --workspace client install @tanstack/react-query
```

## 1) ครอบ App ด้วย QueryClientProvider

แก้ที่ `client/src/main.jsx` — สร้าง `QueryClient` เดียว พร้อม `QueryCache({ onError })` กลาง เพื่อจัดการ `401` ที่จุดเดียว แทนที่จะเช็ค `error instanceof ApiError && error.status === 401` กระจายอยู่ใน `App.jsx`, `EquipmentManager.jsx`, `EquipmentDetailPage.jsx` เหมือนตอนนี้:

```js
// main.jsx
import { QueryCache, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ApiError } from './api/http.js';

const queryClient = new QueryClient({
  queryCache: new QueryCache({
    onError: (error) => {
      if (error instanceof ApiError && error.status === 401) {
        queryClient.setQueryData(['auth', 'me'], null);
        // ไม่ต้อง redirect เอง — App.jsx render หน้า Login ทันทีที่ ['auth','me'] เป็น null (ดูข้อ 2)
      }
    },
  }),
  defaultOptions: {
    queries: { retry: false }, // 401/404 ไม่ควร retry, ผิดจาก default ของ TanStack Query
  },
});

// <QueryClientProvider client={queryClient}><BrowserRouter>...
```

## 2) Query keys convention

ใช้ array key ให้สอดคล้องกับ path จริงของ API เพื่อ debug ง่ายใน React Query Devtools:

| Query key | มาจาก endpoint | ใช้ที่ (ปัจจุบัน) |
|---|---|---|
| `['auth', 'me']` | `GET /api/auth/me` | `App.jsx` |
| `['admin-users']` | `GET /api/admin/users` | `App.jsx` |
| `['equipment']` | `GET /api/equipment-items` | `EquipmentManager.jsx` |
| `['equipment', 'deleted']` | `GET /api/admin/equipment-items/deleted` | `EquipmentManager.jsx` |
| `['equipment', code]` | `GET /api/equipment-items/:code` | `EquipmentDetailPage.jsx` |
| `['equipment', itemId, 'history']` | `GET /api/admin/equipment-items/:id/history` | `EquipmentManager.jsx` (history dialog) |
| `['categories']` | `GET /api/categories` | `EquipmentManager.jsx`, `EquipmentDetailPage.jsx` |
| `['locations']` | `GET /api/locations` | `EquipmentManager.jsx`, `EquipmentDetailPage.jsx` |

ฟังก์ชันเรียก API เดิมใน `client/src/api/*.js` (`getEquipment`, `getCategories`, `login`, ฯลฯ) **ใช้ต่อได้เลยไม่ต้องแก้** — งานของ Phase 2 คือเปลี่ยนที่ "เรียกใช้" ฟังก์ชันเหล่านี้จาก `useEffect` เป็น `queryFn` เท่านั้น

## 3) Query ที่จะแปลง

| ตอนนี้ (useState+useEffect) | เปลี่ยนเป็น | queryKey |
|---|---|---|
| `App.jsx` — `loadCurrentUser()` | `useQuery` | `['auth', 'me']` |
| `App.jsx` — `loadUsers()` (เฉพาะ admin) | `useQuery` (`enabled: user?.role === 'admin'`) | `['admin-users']` |
| `EquipmentManager.jsx` — โหลดตอนเปิดหน้า | `useQuery` | `['equipment']`, `['categories']`, `['locations']` |
| `EquipmentManager.jsx` — `reloadDeletedEquipment()` | `useQuery` (`enabled: view === 'deleted'`) | `['equipment', 'deleted']` |
| `EquipmentManager.jsx` — `openHistory()` | `useQuery` (`enabled: historyEquipment != null`) | `['equipment', itemId, 'history']` |
| `EquipmentDetailPage.jsx` — `loadEquipment()` | `useQuery` | `['equipment', code]` |

ตัวอย่างเปลี่ยน `['equipment']`:

```js
// เดิมใน EquipmentManager.jsx: useState + useEffect + setLoading/setError มือ
const { data, isLoading, error } = useQuery({
  queryKey: ['equipment'],
  queryFn: getEquipment, // จาก api/equipment.js เดิม ไม่ต้องแก้
});
const equipment = data?.equipment ?? [];
```

`auth/me` ต้องปิด retry เพื่อไม่ให้ยิงซ้ำตอนยังไม่ login (401 เป็นเรื่องปกติ ไม่ใช่ error ที่ควร retry):

```js
const { data, isLoading } = useQuery({
  queryKey: ['auth', 'me'],
  queryFn: getCurrentUser,
  retry: false,
});
const user = data?.user ?? null;
// isLoading แทน checkingSession เดิมได้เลย
```

## 4) Mutation ที่จะแปลง

หลักการ: ทุก mutation ที่เคยตามด้วย `reloadActiveEquipment()`/`reloadDeletedEquipment()`/โหลดซ้ำมือ ให้เปลี่ยนเป็น `invalidateQueries` ใน `onSuccess` แทน

| ตอนนี้ (`EquipmentManager.jsx`/`App.jsx`) | เปลี่ยนเป็น | invalidate |
|---|---|---|
| `submitForm()` → `createEquipment`/`updateEquipment` | `useMutation` | `['equipment']` |
| `changeStatus()` → `updateEquipmentStatus` | `useMutation` | `['equipment']` |
| `removeItem()` → `deleteEquipment` | `useMutation` | `['equipment']`, `['equipment', 'deleted']` |
| `restoreItem()` → `restoreEquipment` | `useMutation` | `['equipment']`, `['equipment', 'deleted']` |
| `App.updateUserRole()` → `updateUserRole` | `useMutation` | `['admin-users']` (หรือ optimistic — ดูข้อ 5) |

ตัวอย่าง `createEquipment`/`updateEquipment` (ฟอร์มเดียวใช้ทั้งสองโหมดเหมือนโค้ดปัจจุบัน):

```js
const queryClient = useQueryClient();

const saveEquipment = useMutation({
  mutationFn: (payload) =>
    formMode === 'edit'
      ? updateEquipment(editingEquipment.item_id, payload)
      : createEquipment(payload),
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['equipment'] });
    closeForm();
  },
});

// ใน JSX: onSubmit={(payload) => saveEquipment.mutate(payload)}
// แทน submitting เดิมด้วย saveEquipment.isPending
// แทน error เดิม (เฉพาะจุดนี้) ด้วย saveEquipment.error?.message
```

> `notice`/`error` แบบข้อความเฉพาะจุด (เช่น "เพิ่มครุภัณฑ์สำเร็จ", "เปลี่ยนสถานะ STAT-0001 สำเร็จ") **TanStack Query ไม่ได้ครอบให้** เพราะเป็น UI copy ไม่ใช่ data-fetching state — ยังต้อง `setNotice(...)` ใน `onSuccess` ของแต่ละ mutation เหมือนเดิม มีแค่ `loading`/`error` ของตัว request เท่านั้นที่ครอบให้

## 5) Optimistic update — `updateUserRole`

สเปกของโปรเจกต์เปิดทางเลือกไว้ ถ้าต้องการ UX ที่ลื่นกว่า (ตารางเปลี่ยนทันทีไม่ต้องรอ response):

```js
const updateRole = useMutation({
  mutationFn: ({ userId, role }) => updateUserRoleRequest(userId, role),
  onMutate: async ({ userId, role }) => {
    await queryClient.cancelQueries({ queryKey: ['admin-users'] });
    const previous = queryClient.getQueryData(['admin-users']);

    queryClient.setQueryData(['admin-users'], (old) => ({
      users: old.users.map((u) =>
        u.user_id === userId ? { ...u, role } : u,
      ),
    }));

    return { previous }; // เก็บไว้ rollback ถ้า error
  },
  onError: (_err, _vars, context) => {
    queryClient.setQueryData(['admin-users'], context.previous);
  },
  onSettled: () => {
    queryClient.invalidateQueries({ queryKey: ['admin-users'] });
  },
});
```

ถ้าไม่อยากเพิ่มความซับซ้อนตอนแรก ใช้ `onSuccess: () => invalidateQueries(['admin-users'])` แบบ mutation อื่นไปก่อนได้ แล้วค่อยเปลี่ยนเป็น optimistic ทีหลังถ้าต้องการ

## 6) การจัดการ 401 แบบ global

ปัจจุบันทุก catch block เช็คเอง:

```js
if (actionError instanceof ApiError && actionError.status === 401) {
  onUnauthorized(); // เรียก clearSession ที่ส่งมาจาก App
  return;
}
```

Phase 2 ย้าย logic นี้มาไว้ที่ `QueryCache({ onError })` จุดเดียว (ข้อ 1) — component ไม่ต้องเช็ค `instanceof ApiError` เองอีกต่อไป เพราะ query/mutation ไหน 401 ก็จะโดน `onError` กลางทำให้ `['auth', 'me']` กลายเป็น `null` และ `App.jsx` จะ render หน้า Login ให้เองตาม state ปัจจุบันที่มันเช็ค `if (user) { ... } else { <AuthForm /> }` อยู่แล้ว — ไม่ต้องมี `onUnauthorized`/`onSessionExpired` prop ส่งต่อกันหลายชั้นเหมือนตอนนี้

## 7) State ที่เหลือหลังย้าย (UI-only)

State พวกนี้ **ไม่ใช่หน้าที่ของ TanStack Query** เพราะไม่ใช่ข้อมูลจาก server — ยังอยู่เป็น `useState` ตามเดิม:

- `App.jsx`: `authMode`, `name`, `email`, `password`, `error`/`successMessage` ของฟอร์ม login/register
- `EquipmentManager.jsx`: `view`, `formMode`, `editingEquipment`, `confirmingDeleteId`, `historyEquipment`, `qrEquipment`, `notice`
- `EquipmentDetailPage.jsx`: `editing`, `showQr`, `notice`

State ที่จะ**หายไป**เพราะ TanStack Query ครอบให้แล้ว: `loading`/`error` ของแต่ละ fetch, ตัว list ผลลัพธ์ (`equipment`, `deletedEquipment`, `categories`, `locations`, `users`), `checkingSession`, `submitting`, `busyItemId` (ใช้ `mutation.isPending` + `mutation.variables` แทนได้), `historyLoading`

## 8) ลำดับการทำ (แนะนำ)

1. ติดตั้ง + ครอบ `QueryClientProvider` ใน `main.jsx` — ยังไม่แตะ component ไหน ต้องรันได้ปกติเหมือนเดิม
2. แปลง `['auth', 'me']` ใน `App.jsx` อย่างเดียวก่อน ทดสอบ login/refresh/logout ให้ผ่าน
3. แปลง queries ที่เหลือทีละไฟล์ (`EquipmentManager.jsx` → `EquipmentDetailPage.jsx` → `admin-users`)
4. แปลง mutations ทีละตัว พร้อม `invalidateQueries`
5. ลบ state ที่ TanStack Query ครอบให้แล้วออกตามข้อ 7
6. ลบ `onUnauthorized`/`onSessionExpired` prop-drilling ที่ไม่จำเป็นอีกต่อไปตามข้อ 6

ทำทีละข้อ รันแอปทดสอบระหว่างทางทุกข้อ ไม่ใช่เปลี่ยนทั้งไฟล์รวดเดียว — งานนี้ยังไม่เริ่มจนกว่าจะทดสอบ Phase 1 (cookie auth) ผ่านในเบราว์เซอร์ก่อน
