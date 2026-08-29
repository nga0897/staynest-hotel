# Deploy lên Render

## Bước 1: Push code lên GitHub

```bash
git add .
git commit -m "Deploy staynest hotel to Render"
git push origin main
```

## Bước 2: Kết nối Render với GitHub

1. Đăng nhập vào [Render.com](https://render.com)
2. Click **New +** → **Web Service**
3. Chọn **Connect a repository**
4. Tìm và chọn repository `staynest-hotel`
5. Click **Connect**

## Bước 3: Cấu hình Deployment

- **Name**: `staynest-hotel`
- **Environment**: `Node`
- **Build Command**: `npm install`
- **Start Command**: `npm start`
- **Plan**: Free (hoặc Paid tùy ý)

## Bước 4: Advanced Settings

1. Thêm **Persistent Disk** (nếu muốn giữ dữ liệu upload):
   - **Mount Path**: `/var/data/uploads`
   - **Size**: 10 GB (Free tier)

2. Hoặc cấu hình **Environment Variable** để lưu trữ khác

## Bước 5: Deploy

Click **Create Web Service** → Render sẽ tự động build và deploy

## Sau khi Deploy

- Truy cập trang public: `https://staynest-hotel.onrender.com`
- Truy cập admin: `https://staynest-hotel.onrender.com/admin`

## Lưu ý

- **File data**: Dữ liệu hotel.json sẽ lưu trên server (có thể mất khi redeploy nếu không dùng Persistent Disk)
- **Upload**: File upload sẽ được lưu trong `/public/uploads`
- **Free tier**: Render tắt service sau 15 phút không hoạt động (cold start)

## Tự động redeploy

Mỗi lần bạn push lên GitHub, Render sẽ tự động build và deploy (nếu đã kết nối CI/CD)
