import React from "react";
import { gradients } from "../theme";
import { Scene } from "../components/Scene";
import { Heading } from "../components/Heading";
import { BulletList } from "../components/BulletList";

export const ContextScene: React.FC = () => {
  return (
    <Scene background={gradients.red}>
      <Heading from={0} size={56}>
        Trước đây: portal dựng trong n8n
      </Heading>
      <div style={{ height: 48 }} />
      <BulletList
        from={25}
        items={[
          "100 node, dựng HTML bằng cách nối chuỗi trong Code node",
          "Dropdown không đọc được dữ liệu động",
          "Thẻ <script> bị strip khỏi form",
          "Session phải nhét vào query string",
          "Mỗi endpoint tự kiểm một chuỗi tĩnh dùng chung",
        ]}
      />
      <div style={{ height: 56 }} />
      <Heading from={130} size={40} color="#FFE8B0">
        Pipeline SignalHire vẫn chạy tốt → giữ lại. Portal → thay bằng app riêng.
      </Heading>
    </Scene>
  );
};
