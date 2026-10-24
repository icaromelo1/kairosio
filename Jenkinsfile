// Pipeline do Jenkins da VM (icaromelodev.com.br/jenkins).
// main = produção (/kairos + kairos-api) · main-refactor = staging (/lab/kairos + kairos-stg-api).
// Outras branches só buildam a UI.
@Library('vm') _

def ambientes = [
  'main': [base: '/kairos/', apiPrefixo: '', site: 'kairos/site', nginx: 'kairos', api: 'kairos-api'],
  'main-refactor': [base: '/lab/kairos/', apiPrefixo: '/lab/kairos-api', site: 'lab/sites/kairos', nginx: 'lab', api: 'kairos-stg'],
]
def alvo = ambientes[env.BRANCH_NAME]

pipeline {
  agent { label 'vm' }

  options {
    timestamps()
    disableConcurrentBuilds()
    timeout(time: 30, unit: 'MINUTES')
  }

  environment {
    AMBIENTE = "${env.BRANCH_NAME == 'main' ? 'producao' : (alvo ? 'staging' : 'dev')}"
  }

  stages {
    stage('Build da UI') {
      steps {
        script {
          def base = alvo?.base ?: '/kairos/'
          def prefixo = alvo?.apiPrefixo ? "VITE_API_PREFIX=${alvo.apiPrefixo} " : ''
          docker.image('node:22').inside(ambienteNode()) {
            sh "cd kairos-ui && npm ci --legacy-peer-deps && ${prefixo}npx vite build --base=${base}"
          }
        }
      }
    }

    stage('Publicar a UI') {
      when { expression { alvo } }
      steps {
        sh """
          set -e
          destino="\$HOME/projects/${alvo.site}"
          mkdir -p "\$destino"
          find "\$destino" -mindepth 1 -delete
          cp -a kairos-ui/dist/. "\$destino/"
          docker exec ${alvo.nginx} nginx -s reload
        """
      }
    }

    stage('Publicar a API') {
      when { expression { alvo } }
      steps {
        sh """
          set -e
          app="\$HOME/projects/${alvo.api}/app"
          rm -rf "\$app/src"
          tar -C kairos-api --exclude=node_modules --exclude=dist --exclude=music-cache --exclude=avatar-cache -cf - . | tar -xf - -C "\$app"
          cd "\$HOME/projects/${alvo.api}" && docker compose up -d --build
        """
      }
    }
  }

  post {
    always { cleanWs(deleteDirs: true, notFailBuild: true) }
  }
}
