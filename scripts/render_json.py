#! /usr/bin/env python3
from PIL import Image
import argparse
import pathlib
import json

WIDTH = 2000
HEIGHT = 2000

colors = {1: (190, 0, 57, 255), 0: (109, 0, 26, 255), 2: (255, 69, 0, 255), 3: (255, 168, 0, 255), 4: (255, 214, 53, 255), 5: (255, 248, 184, 255), 6: (0, 163, 104, 255), 7: (0, 204, 120, 255), 8: (126, 237, 86, 255), 9: (0, 117, 111, 255), 10: (0, 158, 170, 255), 11: (0, 204, 192, 255), 12: (36, 80, 164, 255), 13: (54, 144, 234, 255), 14: (81, 233, 244, 255), 15: (73, 58, 193, 255), 16: (
    106, 92, 255, 255), 17: (148, 179, 255, 255), 18: (129, 30, 159, 255), 19: (180, 74, 192, 255), 20: (228, 171, 255, 255), 21: (222, 16, 127, 255), 22: (255, 56, 129, 255), 23: (255, 153, 170, 255), 24: (109, 72, 47, 255), 25: (156, 105, 38, 255), 26: (255, 180, 112, 255), 27: (0, 0, 0, 255), 28: (81, 82, 82, 255), 29: (137, 141, 144, 255), 30: (212, 215, 217, 255), 31: (255, 255, 255, 255)}


def hex_to_col(hex_str, alpha=0xff):
    assert hex_str[0] == "#" and len(hex_str) == 7

    def conv(s):
        return int(s, 16)
    return (conv(hex_str[1:3]), conv(hex_str[3:5]), conv(hex_str[5:7]))


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("files", nargs="*",
                        type=pathlib.Path, default=["pixel.json"])
    args = parser.parse_args()

    img = Image.new("RGBA", (WIDTH, HEIGHT), "#00000000")

    for file in args.files:
        with open(file) as f:
            data = json.loads(f.read())
        for name, part in data["structures"].items():
            print(f"rendering {name}")
            pixels = part["pixels"]
            for pixel in pixels:
                x = pixel["x"]
                y = pixel["y"]
                color_index = pixel["color"]
                if type(color_index) is str:
                    color = hex_to_col(color_index)
                    print(f"converted {color_index} to {color}")
                else:
                    color = colors[color_index]
                img.putpixel((x, y), color)
    img.save("output.png")
