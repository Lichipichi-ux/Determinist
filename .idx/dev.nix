{ pkgs, ... }: {
  channel = "stable-24.05"; # Or "unstable"
  packages = [
    pkgs.nodejs_20
  ];
  idx = {
    extensions = [
      
    ];
    previews = {
      enable = true;
      previews = {
        web = {
          command = [
            "npm"
            "run"
            "dev"
            "--"
            "--port"
            "$PORT"
            "--host"
            "0.0.0.0"
          ];
          manager = "web";
        };
      };
    };
  };
}
