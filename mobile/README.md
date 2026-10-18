# SchoolHub — ứng dụng di động (Expo / React Native)

Dùng chung API với bản web (`backend-mongo`). Chức năng theo chức danh — xem `frontend/requirement.txt`, mục *React native*:

| Chức danh | Màn hình |
|---|---|
| Ban giám hiệu, Tài khoản trường | Thông báo (xem + soạn), Thi đua (tổng kết tuần / tháng) |
| Đoàn thanh niên | Thi đua (tổng kết tuần / tháng), Thông báo |
| Giáo viên chủ nhiệm | Thi đua lớp mình + danh sách học sinh bị ghi sổ (lưu / chia sẻ), Kết quả bài tập, TKB của tôi, Thông báo (xem + soạn cho lớp) |
| Giáo viên | Kết quả bài tập, TKB của tôi, Thông báo |
| Cờ đỏ | Chấm thi đua, TKB lớp, Bài thi, Thông báo |
| Học sinh | TKB, Bài thi, Thông báo |
| Tất cả | Tài khoản: đổi thông tin, đổi mật khẩu, đăng xuất |

## Cài đặt

Cần **Node.js ≥ 22.13** (Expo SDK 57).

```bash
cd mobile
npm install
cp .env.example .env   # sửa EXPO_PUBLIC_API_URL
```

`EXPO_PUBLIC_API_URL` là địa chỉ backend **mà điện thoại truy cập được**, ví dụ `http://192.168.1.10:3001/api`
(IP LAN của máy đang chạy `backend-mongo`; điện thoại và máy tính cùng mạng Wi-Fi). Không dùng `localhost`.
Khi đưa lên máy chủ thật, đặt địa chỉ `https://…/api`.

## Chạy thử bằng Expo Go

1. Cài app **Expo Go** trên điện thoại (Android / iOS).
2. Chạy backend: `cd backend-mongo && npm run dev`.
3. Chạy app: `cd mobile && npx expo start`, quét mã QR bằng Expo Go (Android) hoặc Camera (iOS).

Đổi `.env` thì cần tắt và chạy lại `npx expo start`.

## Build APK / IPA bằng EAS

```bash
npm install -g eas-cli
eas login
eas build:configure
eas build -p android --profile preview   # ra file .apk cài trực tiếp
eas build -p ios                          # cần tài khoản Apple Developer
```

Bản build chính thức nên dùng backend `https://`. Android 9+ chặn `http://` trong bản build
(Expo Go thì vẫn chạy được) — nếu bắt buộc dùng `http://`, thêm plugin `expo-build-properties`
với `android.usesCleartextTraffic: true`.

## Cấu trúc

```
App.js                     điểm vào
src/api/client.js          gọi API (token lưu bằng expo-secure-store)
src/context/AuthContext.js đăng nhập / đăng xuất
src/navigation/            tab theo chức danh
src/screens/               các màn hình
src/components/            thành phần giao diện dùng chung
```

## Lỗi thường gặp

- **`TypeError: URL.parse is not a function`** khi điện thoại kết nối: Node.js quá cũ, cài Node 22 LTS trở lên rồi mở lại terminal.
- **"Project is incompatible with this version of Expo Go"**: mỗi bản Expo Go chỉ chạy được 1 phiên bản Expo SDK. App đang dùng **SDK 57**
  (bản Expo Go trên Play Store hỗ trợ). Khi Expo Go cập nhật lên SDK mới hơn, nâng app theo:
  `npm install expo@~58.0.0 && npx expo install --fix` (đổi 58 thành số SDK mà Expo Go yêu cầu).
